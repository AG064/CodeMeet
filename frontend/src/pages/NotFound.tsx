import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200">
      <div className="text-center space-y-4">
        <h1 className="text-7xl font-bold text-indigo-500">404</h1>
        <p className="text-xl text-zinc-400">Page not found</p>
        <p className="text-sm text-zinc-500">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/dashboard"
          className="inline-block mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
