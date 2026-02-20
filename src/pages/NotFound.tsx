import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="mb-4">Page not found</p>
      <Link to="/" className="text-blue-500 hover:underline">
        Go to Microscope
      </Link>
    </div>
  );
}
