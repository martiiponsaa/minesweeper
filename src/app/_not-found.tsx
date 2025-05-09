import Link from 'next/link';
import React from 'react';

const NotFound: React.FC = () => {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <p>
        <Link href="/">View Home</Link>
      </p>
    </div>
  );
};

export default NotFound;