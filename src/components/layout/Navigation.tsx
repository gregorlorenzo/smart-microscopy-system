import { Link, useLocation } from 'react-router-dom';
import { Camera, Library } from 'lucide-react';

export default function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Microscope', icon: Camera },
    { path: '/library', label: 'Library', icon: Library },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all duration-200 ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
