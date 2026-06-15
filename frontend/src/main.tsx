import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';

import App from './App';
import './index.css';

const theme = {
  token: {
    colorPrimary: '#f75b00',
    colorInfo: '#f75b00',
    colorSuccess: '#2d2d2d',
    colorWarning: '#f75b00',
    colorError: '#ba3b24',
    borderRadius: 24,
    colorBgBase: '#f3f5f7',
    colorTextBase: '#111111',
    fontFamily: '"Prompt", "Segoe UI", sans-serif',
  },
  components: {
    Button: {
      fontWeight: 500,
      controlHeightLG: 52,
    },
    Input: {
      controlHeightLG: 52,
    },
    Select: {
      controlHeight: 52,
    },
    Card: {
      borderRadiusLG: 30,
    },
    Modal: {
      borderRadiusLG: 28,
    },
    Drawer: {
      paddingLG: 24,
    },
    Table: {
      headerBg: '#f3f5f7',
      headerColor: '#222222',
      borderColor: '#d4d9df',
      rowHoverBg: '#fafbfc',
    },
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
