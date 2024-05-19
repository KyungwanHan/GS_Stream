import React from 'react';
import StyledLink from './StyledLink';
import WelcomeMessage from './WelcomeMessage';

const SingleViewHeader = ({ userName, leftModelName, rightModelName }) => {
  return (
    <>
      <h1>
        <StyledLink to="/">Web Inspector 2.0</StyledLink>
      </h1>{' '}
      User: {userName}, Left Model: {leftModelName}, Right Model:
      {rightModelName} <br />
      <WelcomeMessage />
    </>
  );
};

export default SingleViewHeader;
