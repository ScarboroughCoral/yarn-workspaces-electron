import sharp from 'sharp';

import { API } from '@app/shared';
import { send } from './utils';
import AdmZip from 'adm-zip';
import { readdir, rmdir } from 'fs';
import path from 'path';
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
/**
 * Example of native module. Generates an image.
 */
const processImage = async () => {
  console.log(`[BE] process image`);

  await sharp({
    create: {
      width: 3000,
      height: 3000,
      channels: 4,
      background: { r: 0, g: 255, b: 0, alpha: 0.5 }
    }
  })
    .toBuffer()
    .catch();
};

const router: API.BE.MessageHandler = {
  PROCESS_IMAGE_ASYNC: async () => {
    const start = new Date().getTime();
    await processImage();
    const end = new Date().getTime();

    send({
      type: 'ADD_NOTIFICATION',
      payload: {
        text: `[BE processed image] - ${end - start}ms`
      }
    });

    return true;
  },

  PROCESS_IMAGE_BATCH: async () => {
    console.log(`[BE] Process iamge batch`);

    const start = new Date().getTime();
    for (let i = 0; i < 10; i++) await processImage();
    const end = new Date().getTime();

    send({
      type: 'ADD_NOTIFICATION',
      payload: {
        text: `[BE processed x10 images] - ${end - start}ms`
      }
    });

    return true;
  },
  PROCESS_ZIP_EXTRACT: async () => {
    console.log(`[BE] Process zip extract`);
    
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
    send({
      type: 'ADD_NOTIFICATION',
      payload: {
        text: `[BE processed zip] - ${end - start}ms`
      }
    });
    return true;
  }
};

/**
 * Message handlers, for notifications comming from the fronted
 */
async function messageHander(message: API.BE.Messages) {
  console.log(`[BE] receive, type: ${message.type}`);
  console.log(`[BE] receive, payload: ${JSON.stringify(message)}`);

  if (!router[message.type]) {
    return Promise.reject(`[BE] unhanded message type: ${message.type}`);
  }

  return await router[message.type](message as any);
}

export default {
  _history: [],
  message: messageHander
};
