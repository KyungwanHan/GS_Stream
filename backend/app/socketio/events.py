import base64
from flask import request
from flask_socketio import SocketIO, emit
from ..image_renderer.image_creator import *
from ..image_renderer.render_wrapper import decompose_44
import logging
import os
from ..model_config.model_config_fetcher import ModelManager

model_manager = ModelManager()

user_name = ''
model_ids = None
user_states = {}

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def configure_socketio(socketio: SocketIO):
    @socketio.on('connect')
    def handle_connect():
        user_states[request.sid] = {'connected': True}
        print(f'Client connected: {request.sid}')
        emit('response', {'message': 'Connected to server'})
            
    @socketio.on('disconnect')
    def handle_disconnect():
        del user_states[request.sid]
        print(f'User {user_name} has disconnected.')

    @socketio.on('set_user_data')
    def handle_get_user_name(data):
        if data is not None:
            set_user_data(data)
            set_user_init_pose()
        else:
            print("Data is None")
            emit('response', {'message': 'Data is None'})
            
    @socketio.on('get_init_image')
    def handle_get_init_image(model_id):
        model = model_manager.get_model(model_id)
        init_image = model.get_init_image()
        base64_img = make_base64_img(init_image)
        print(f'Message to {user_name} for {model_id} model: get_init_image')
        data = {
            'modelId': model_id,
            'image': base64_img
        }
        emit('set_client_init_image', data)

    @socketio.on('reset_pose')
    def handle_reset_pose(model_id):
        user_states[request.sid][model_id]['current_pose'] = user_states[request.sid][model_id]['init_pose']
        print(f'Reset pose for User:{user_name} for {model_id} model')
        emit('response', {'message': 'Pose reset'})

    @socketio.on('key_control')
    def handle_key_control(data):
        keys, step = data['key'], data['step']
        print(f'Keys:{keys}, Step:{step} are received from User:{user_name}')
        
        def is_space_bar_pressed(keys):
            return ' ' in keys and keys[' ']
        
        def get_pressed_keys(keys):
            pressed_keys = ''.join(key for key, pressed in keys.items() if pressed)
            pressed_keys = pressed_keys[:2]  # Limit the length to 2
            return pressed_keys

        if is_space_bar_pressed(keys):
            handle_space_key()            
        else:
            pressed_keys = get_pressed_keys(keys)
            if pressed_keys:
                handle_other_keys(pressed_keys, step)
            calculate_altitude()
                    
    @socketio.on('get_asset_pose')
    def handle_get_asset_pose(data):
        model_ids, index = data['selectedModelId'], data['index']
        for model_id in model_ids:
            send_asset_data(model_id, index)

    
# function for socket            
def set_user_data(data):
    global user_name
    global model_ids
    if 'userName' in data:
        user_name = data['userName']
        print(f'User:\'{user_name}\' connected')
        emit('response', {'message': 'Setting User Name', 'userName': user_name})
    if 'modelIds' in data and isinstance(data['modelIds'], list):
        model_ids = data['modelIds']
        print(f"Received model IDs: {model_ids}")
        print(f"Number of models received: {len(model_ids)}")

# function for socket            
def set_user_init_pose():
    user_models = user_states.setdefault(request.sid, {})
    for model_id in model_ids:
        model = model_manager.get_model(model_id)
        if model:
            user_models[model_id] = {
                'init_pose': model.init_pose(),
                'current_pose': model.init_pose()
            }
                  
# function for socket            
def send_asset_data(model_id, index):
    pose_data = model_manager.get_model_asset_pose(model_id, index)
    print(f'Asset pose for {model_id} model and index {index} is {pose_data}')
    R, T = np.array(eval(pose_data["R_mat"])), np.array(eval(pose_data["T_vec"]))
    cam = DummyCamera(R=R, T=T, W=1000, H=1000, FoVx=1.4261863218, FoVy=1.261863218)
    model = model_manager.get_model(model_id)
    img_data = model.render_model_image(cam)  # Render and save the model image  
    base64_img = make_base64_img(img_data)
    user_states[request.sid][model_id]['current_pose'] = cam.get_new_pose()
    print(f'Message to {user_name}: set_client_main_image')
    data = {
        'modelId': model_id,
        'image': base64_img
    }
    emit('set_client_main_image', data)

def calculate_altitude():
    # Select only one model for now
    model_id = model_ids[0]
    model = model_manager.get_model(model_id)
    current_pose = user_states[request.sid][model_id]['current_pose']
    R, T = decompose_44(np.array(current_pose))
    altitude, heading = model.get_flight_params(R, T) 
    logging.info(f'Altitude: {altitude} and Heading: {heading}')
    emit("flight_params", {'altitude': altitude, 'heading': heading})

def handle_space_key():
    # Select only one model for now
    model_id = model_ids[0]
    current_pose = user_states[request.sid][model_id]['current_pose']
    
    # Get the closest images for the current pose of the model
    for model_id in model_ids:
        model = model_manager.get_model(model_id)
        filenames = model.images.get_closest_n(pose=current_pose, n=3)
        print("The closest images are: " + ', '.join(str(x) for x in filenames))
        closest_images = {}
        filepath = model.images_thumbnails
        for file in filenames:
            with open(os.path.join(filepath, file), 'rb') as f:
                img_data = f.read()
                # Encode img_data to base64
                closest_images[file] = base64.b64encode(img_data).decode('utf-8')
        data = {
            'modelId': model_id,
            'images': closest_images
        }
        emit("nnImg", data)


def handle_other_keys(keys, step):
    print(f'Handle key input for {keys} from the client')
    
    # Select only one model for now
    model_id = model_ids[0]
    
    # Get the current pose of the model
    cam = None
    pose = user_states[request.sid][model_id]['current_pose']       

    # Change the cam and pose based on the key input
    for key in keys:
        cam = get_changed_cam(pose, key, step)
        pose = cam.get_new_pose()

    # Render the model image with the new cam and pose
    for model_id in model_ids:
        img_data = model_manager.get_model(model_id).render_model_image(cam)  # Render and save the model image  
        base64_img = make_base64_img(img_data)
        user_states[request.sid][model_id]['current_pose'] = pose # Update the current pose
        print(f'Message to {user_name}: set_client_main_image')
        data = {
            'modelId': model_id,
            'image': base64_img
        }
        emit('set_client_main_image', data)

def make_base64_img(image):
    image.seek(0)
    base64_img = base64.b64encode(image.read()).decode('utf-8')
    return base64_img
