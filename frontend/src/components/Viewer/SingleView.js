import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client';

import { useKeyControl } from './UseKeyControl';

import 'styles/viewer_style.css';
import SingleViewHeader from './SingleViewHeader';
import CanvasContainer from './CanvasContainer';
import ResetButton from './ResetButton';
import StepControl from './StepControl';
import InformationBox from './InformationBox';

const SingleView = () => {
  const location = useLocation();
  let userName = 'defaultUserName';
  let selectedModelId = 0;
  let selectedModelName = 'defaultSelectedModel';

  if (location && location.state) {
    userName = location.state.userName || userName;
    selectedModelId = location.state.selectedModelId || selectedModelId;
    selectedModelName = location.state.selectedModelName || selectedModelName;
  }

  const lastKeyPressedTime = useRef(0);
  const socketRef = useRef(null);
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState('');
  const initStepValue = 1;
  const [resetKey, setResetKey] = useState(0);
  const [mainImage, setMainImage] = useState('');
  const [nnImages, setNnImages] = useState(['', '', '']);
  const [elevation, setElevation] = useState(0);
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    const backendAddress = process.env.REACT_APP_BACKEND_URL;
    if (!socketRef.current) {
      socketRef.current = io(backendAddress);
    }

    socketRef.current.on('connect', () => {
      socketRef.current.emit('set_user_data', {
        userName: userName,
        modelIds: [selectedModelId],
      });
      console.log('Connected to Socket.IO server');
      socketRef.current.emit('get_init_image', selectedModelId);
    });

    socketRef.current.on('response', (message) => {
      console.log('Received message from Socket.IO:', message);
    });

    socketRef.current.on('set_client_init_image', (data) => {
      console.log('Received init image');
      setMainImage(data.image);
    });

    socketRef.current.on('set_client_main_image', (data) => {
      console.log('Received main image');
      setMainImage(data.image);
    });

    socketRef.current.on('nnImg', (data) => {
      console.log('Received nnImages');
      const entries = Object.entries(data.images);
      setNnImages(entries.map(([, image]) => image));
    });

    socketRef.current.on('flight_params', (data) => {
      console.log('Received flight_params');
      setElevation(data.altitude);
      setHeading(data.heading);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      console.log('Disconnected from Socket.IO server');
    };
  }, []);

  useKeyControl(step, lastKeyPressedTime, socketRef);

  const handleResetClick = () => {
    setResetKey((prevKey) => prevKey + 1);
    setStep(initStepValue);
    setNnImages(['', '', '']);
    if (socketRef.current) {
      socketRef.current.emit('get_init_image', selectedModelId);
      socketRef.current.emit('reset_pose', selectedModelId);
    }
    setElevation(0);
    setHeading(0);
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
      <SingleViewHeader
        userName={userName}
        selectedModelName={selectedModelName}
      />
      <CanvasContainer
        containerId="main"
        mainCanvasId="main"
        width="800"
        height="600"
        mainImage={mainImage}
        nnImages={nnImages}
        nnCanvasLocation="right"
        key={resetKey}
      />
      <div className="information-box">
        <InformationBox elevation={elevation} heading={heading} />
      </div>
      <div className="viewer-control-box">
        <StepControl
          step={step}
          decreaseStep={decreaseStep}
          increaseStep={increaseStep}
          message={message}
        />
        <ResetButton handleResetClick={handleResetClick} />
      </div>
      <div id="message">{message}</div>
    </div>
  );
};

export default SingleView;
