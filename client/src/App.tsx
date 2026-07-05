import { Route, Routes } from 'react-router-dom';
import BoardListPage from './pages/BoardListPage.js';
import BoardPage from './pages/BoardPage.js';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BoardListPage />} />
      <Route path="/b/:boardId" element={<BoardPage />} />
    </Routes>
  );
}
