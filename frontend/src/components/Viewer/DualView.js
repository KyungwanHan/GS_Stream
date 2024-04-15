import React, { useRef, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import io from 'socket.io-client';

import DualViewHeader from './DualViewHeader';
import CanvasContainer from './CanvasContainer';
import ResetButton from './ResetButton';
import StepControl from './StepControl';

const DualView = () => {
  let userName = 'defaultUserName';
  let leftModel = 'defaultLeftModel';
  let rightModel = 'defaultRightModel';

  const location = useLocation();
  if (location && location.state) {
    userName = location.state.userName || userName;
    leftModel = location.state.selectedModel || leftModel;
    rightModel = location.state.selectedModelForComparison || rightModel;
  }

  // Socket
  const socketRef = useRef(null);

  // Main Canvas
  const [leftMainImage, setLeftMainImage] = useState('');
  const [rightMainImage, setRightMainImage] = useState('');

  // NN Images Canvas
  const [leftNnImages, setLeftNnImages] = useState(['', '', '']);
  const [rightNnImages, setRightNnImages] = useState(['', '', '']);

  const lastKeyPressedTime = useRef(0);

  const [leftResetKey, setLeftResetKey] = useState('left-0');
  const [rightResetKey, setRightResetKey] = useState('right-0');

  const [step, setStep] = useState(1);
  const initStepValue = 1;
  const [message, setMessage] = useState('');

  useEffect(() => {
    const backendAddress = process.env.REACT_APP_BACKEND_URL;
    if (!socketRef.current) {
      socketRef.current = io(backendAddress);
    }

    socketRef.current.on('connect', () => {
      socketRef.current.emit('set_user_name', userName);
      socketRef.current.emit('get_init_image', leftModel);
      socketRef.current.emit('get_init_image', rightModel);
      console.log('Connected to Socket.IO server');
    });

    socketRef.current.on('response', (message) => {
      console.log('Received message from Socket.IO:', message);
    });

    socketRef.current.on('set_client_init_image', (base64Img) => {
      console.log('Received init image');
      setLeftMainImage(base64Img);
      setRightMainImage(base64Img);
    });

    socketRef.current.on('set_client_main_image', (base64Img) => {
      console.log('Received main image');
      setLeftMainImage(base64Img);
      setRightMainImage(base64Img);
    });

    socketRef.current.on('nnImg', (data) => {
      console.log('Received nnImages');
      const entries = Object.entries(data);
      setLeftNnImages(entries.map(([, base64Img]) => base64Img));
      setRightNnImages(entries.map(([, base64Img]) => base64Img));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      console.log('Disconnected from Socket.IO server');
    };
  }, []);

  useEffect(() => {
    const keyEventHandler = (event) => {
      const currentTime = new Date().getTime();
      if (currentTime - lastKeyPressedTime.current > 30) {
        lastKeyPressedTime.current = currentTime;
        if (socketRef.current) {
          socketRef.current.emit('key_control', { key: event.key, step: step });
        }
      } else {
        console.log('Too many requests!');
      }
    };

    window.addEventListener('keypress', keyEventHandler, false);

    return () => {
      window.removeEventListener('keypress', keyEventHandler, false);
    };
  }, [step]);

  const handleResetClick = () => {
    setLeftResetKey((prevKey) => {
      const numberPart = parseInt(prevKey.split('-')[1], 10);
      return `left-${numberPart + 1}`;
    });
    setRightResetKey((prevKey) => {
      const numberPart = parseInt(prevKey.split('-')[1], 10);
      return `right-${numberPart + 1}`;
    });
    if (socketRef.current) {
      socketRef.current.emit('get_init_image', leftModel);
      socketRef.current.emit('get_init_image', rightModel);
      socketRef.current.emit('reset_pose', leftModel);
      socketRef.current.emit('reset_pose', rightModel);
    }
    setStep(initStepValue);
  };

  const increaseStep = () => {
    setStep((prevStep) => {
      if (prevStep < 10) {
        prevStep += 1;
      } else {
        setMessage('The value cannot exceed 10.');
      }
      return prevStep;
    });
  };

  const decreaseStep = () => {
    setStep((prevStep) => {
      if (prevStep > 1) {
        prevStep -= 1;
      } else {
        setMessage('The value cannot be less than 1.');
      }
      return prevStep;
    });
  };

  return (
    <div className="content">
      <DualViewHeader
        userName={userName}
        leftModel={leftModel}
        rightModel={rightModel}
      />
      <div style={{ display: 'flex' }}>
        <CanvasContainer
          containerId="left-model"
          mainCanvasId="left-model-main-canvas"
          width="600"
          height="475"
          mainImage={leftMainImage}
          nnImages={leftNnImages}
          nnCanvasLocation="left"
          key={leftResetKey}
        />
        <CanvasContainer
          containerId="right-model"
          mainCanvasId="right-model-main-canvas"
          width="600"
          height="475"
          mainImage={rightMainImage}
          nnImages={rightNnImages}
          nnCanvasLocation="right"
          key={rightResetKey}
        />
      </div>
      <ResetButton handleResetClick={handleResetClick} />
      <StepControl
        step={step}
        decreaseStep={decreaseStep}
        increaseStep={increaseStep}
        message={message}
      />
    </div>
  );
};

export default DualView;