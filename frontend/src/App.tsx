import React from 'react';

import { useAppDispatch, useAppSelector } from './store/hooks';
import { ACTIONS } from './store';
import { send } from './API/utils';
import NotificationList from './NotificationList';
import loadingJson from './assets/loading-rainbow.json';
import bgJson from './assets/bg-pc.json';
import { ipcRenderer } from 'electron'

import AdmZip from 'adm-zip';
import { readdir, rmdir } from 'fs';
import path from 'path';
import Lottie from 'lottie-react';
type Task<Args extends unknown[] = [], Result = void> = (...args: Args) => Promise<Result>

const idle: Task = () => Promise.resolve()

type Next = (count: number) => Task | undefined
const serialConsume: Task<[Next, number?, Task?]> = (next, count = 0, task = next(count)) => {
  return task ? task().then(() => serialConsume(next, count + 1)) : idle()
}
const serial: Task<[Task[]]> = tasks => {
  return serialConsume(index => tasks[index])
}
const parallel: Task<[Task[]]> = tasks => {
  return Promise.all(tasks.map(task => task())).then(idle)
}
const batch: Task<[Task[], number]> = (tasks, batchSize) => {
  return parallel(Array.from({ length: batchSize }, () => () => serialConsume(() => tasks.shift())))
}
const App = () => {
  const dispatch = useAppDispatch();

  const notifications = useAppSelector((s) => s.notifications);

  const handleProcessImageAsync = async () => {
    // The BE will udpate the redux store with notifications
    const isImageProcessed = await send({
      type: 'PROCESS_IMAGE_ASYNC'
    });

    console.log('Image processed: ', isImageProcessed);
  };

  const handleProcessImageBatch = async () => {
    // The BE will udpate the redux store
    send({
      type: 'PROCESS_IMAGE_BATCH'
    });
  };
  const handleProcessZipBatch = async () => {
    // The BE will udpate the redux store
    send({
      type: 'PROCESS_ZIP_EXTRACT'
    });
  }
  const handleProcessZipBatchFE = async () => {
    // The FE will udpate the redux store
      console.log(`[FE] Process zip extract`);
      
      const start = new Date().getTime();
      const base = path.resolve('zips')
      const targetBase = path.resolve('unzips')
      await new Promise<void>((resolve, reject) => {
        rmdir(targetBase, { recursive: true }, err => {
          if (err) reject(err)
          else resolve()
        }
        )
      }
      )
      const entries = await new Promise<string[]>((resolve, reject) => {
        readdir(base, (err, entries) => {
          if (err) reject(err)
          else resolve(entries)
        })
      })
      await serial(entries.map(entry => () => new Promise((resolve, reject) => {
        new AdmZip(path.resolve(base, entry)).extractAllToAsync(path.resolve(targetBase, entry), true, err => {
          if (err) reject(err)
          else resolve()
        }
        )
      })))
      const end = new Date().getTime();
      dispatch(ACTIONS.addNotification({
        text: `[FE processed zip] - ${end - start}ms`
      }));
      return true;
  };
  const handleProcessZipBatchMain = async () => {
    const result = await ipcRenderer.invoke('extract-zip')
    dispatch(ACTIONS.addNotification({
      text: String(result),
    }));
  }
  const handleReset = async () => {
    dispatch(ACTIONS.resetState());
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: '5rem'
      }}
    >
      <h1 style={{ marginTop: 0 }}>Offline Image Processsing App</h1>
      <br />
      {/* @ts-ignore */}
      <Lottie animationData={bgJson} style={{ width: '192', height: '72' }}  />
      {/* <img
        src="https://react.dev/favicon.ico"
        className="rotate linear infinite"
        alt="img"
        width="80"
        height="80"
      /> */}
      <br />
      <NotificationList
        notifications={notifications}
        handleProcessImageAsync={handleProcessImageAsync}
        handleProcessImageBatch={handleProcessImageBatch}
        handleReset={handleReset}
        handleProcessZipBatchFE={handleProcessZipBatchFE}
        handleProcessZipBatch={handleProcessZipBatch}
        handleProcessZipBatchMain={handleProcessZipBatchMain}
      />
    </div>
  );
};

export default App;
