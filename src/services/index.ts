import { config } from "../config/env";
import { pool } from "../database/pool";
import { GoogleOAuthService } from "./googleOAuth";
import { SessionService } from "./sessionService";
import { UserService } from "./userService";
import { SpotlightChannelService } from "./spotlightChannelService";
import { VideoTranscriptionService } from "./videoTranscriptionService";
import { YouTubeDataApi } from "./youtubeDataApi";
import { ObjectStorageService } from "./objectStorageService";

export const googleOAuthService = new GoogleOAuthService(config.googleOAuth);
export const userService = new UserService(pool);
export const sessionService = new SessionService(config.session, pool);
export const spotlightChannelService = new SpotlightChannelService(pool);
export const videoTranscriptionService = new VideoTranscriptionService(
  pool,
  config.videoTranscription,
);
export const youtubeDataApi = new YouTubeDataApi(config.youtube.apiKey);
export const objectStorageService = new ObjectStorageService(
  config.objectStorage,
);
