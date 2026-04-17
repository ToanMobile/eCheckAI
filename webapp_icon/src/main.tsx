import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate
} from "react-router-dom";
import './index.css';
import { OCRProvider } from './contexts/OCRContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { DocumentDetail } from './pages/DocumentDetail';
import { CategoryManagement } from './pages/CategoryManagement';
import { CategoryDetail } from './pages/CategoryDetail';
import { Archive } from './pages/Archive';
import { ArchiveOverview } from './pages/ArchiveOverview';
import { IgnoreFilename } from './pages/IgnoreFilename';

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        path: "/",
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "/dashboard",
        element: <ArchiveOverview />,
      },
      {
        path: "/archive",
        element: <Archive />,
      },
      {
        path: "/document",
        element: <IgnoreFilename />,
      },
      {
        path: "/document/:id",
        element: <DocumentDetail />,
      },
      {
        path: "/categories",
        element: <CategoryManagement />,
      },
      {
        path: "/categories/:slug",
        element: <CategoryDetail />,
      },
      {
        path: "*",
        element: <Navigate to="/dashboard" replace />,
      }
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OCRProvider>
      <RouterProvider router={router} />
    </OCRProvider>
  </StrictMode>,
);
