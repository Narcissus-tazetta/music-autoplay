import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './popup';
import '../styles/index.css';

const root = document.getElementById('root')!;
createRoot(root).render(
    <StrictMode>
        <Popup />
    </StrictMode>,
);
