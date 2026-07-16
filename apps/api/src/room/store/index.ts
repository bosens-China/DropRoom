import { RoomStoreFiles } from './files.js';

// 对外保持单一存储入口，内部按房间成员、在线状态和文件职责拆分。
export class RoomStore extends RoomStoreFiles {}
