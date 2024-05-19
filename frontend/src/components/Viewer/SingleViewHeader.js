import React from 'react';
import StyledLink from './StyledLink';
import WelcomeMessage from './WelcomeMessage';

const SingleViewHeader = ({ userName, selectedModelName }) => (
  <>
    <h1>
      <StyledLink to="/">Web Inspector 2.0</StyledLink>
    </h1>
    User: {userName}, Model: {selectedModelName} <br />
    <WelcomeMessage />
  </>
);

export default SingleViewHeader;
