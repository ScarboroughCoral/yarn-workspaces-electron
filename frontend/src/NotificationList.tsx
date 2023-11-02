import React from 'react';

import { NotificationType } from '@app/shared';

type Props = {
  notifications: NotificationType[];
  handleProcessImageAsync: () => void;
  handleProcessImageBatch: () => void;
  handleReset: () => void;
  handleProcessZipBatchFE: () => void;
  handleProcessZipBatch: () => void;
};

const NotificationList = ({
  notifications,
  handleProcessImageAsync,
  handleProcessImageBatch,
  handleReset,
  handleProcessZipBatchFE,
  handleProcessZipBatch
}: Props) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
      <button onClick={handleProcessImageAsync}>process image</button>
      <button onClick={handleProcessImageBatch}>process image batch</button>
      <button onClick={handleReset}>RESET</button>
      <button onClick={handleProcessZipBatchFE}>handle Process Zip Batch FE</button>
      <button onClick={handleProcessZipBatch}>handle Process Zip Batch BE</button>
    </div>

    <ul>
      {notifications.map((notifications, i) => (
        <li key={i}>{notifications.text}</li>
      ))}
    </ul>
  </div>
);

export default NotificationList;
