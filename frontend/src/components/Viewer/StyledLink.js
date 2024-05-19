import React from 'react';
import { Link } from 'react-router-dom';

const StyledLink = ({ to, children }) => (
  <Link to={to} style={{ textDecoration: 'none', color: 'black' }}>
    {children}
  </Link>
);

export default StyledLink;
