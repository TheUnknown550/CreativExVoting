import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';

import App from './App';
import './index.css';

const theme = {
  token: {
    colorPrimary: '#56785e',
    colorInfo: '#56785e',
    colorSuccess: '#5d8a67',
    colorWarning: '#b78b4b',
    colorError: '#b34e45',
    borderRadius: 18,
    colorBgBase: '#f7f3ec',
    colorTextBase: '#1f2421',
    fontFamily: '"Manrope", "Segoe UI", sans-serif',
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
