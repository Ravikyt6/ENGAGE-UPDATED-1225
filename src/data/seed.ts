import type {DB,Content,Settings} from '@/types';
export const sampleVideoId='w9UVT95Wz2E';
export const seedContents:Content[]=[];
export const defaultSettings:Settings={rewardPerUser:0.001,campaignCreationCost:0,
  autoplayEnabled: true,adEnabled:false,
  highRevenueBannerEnabled: false,
  profitablerSquareEnabled: false,monetagVignetteEnabled:false,monetagPushCreatedEnabled:false,monetagInPagePushEnabled:false,
  socialBarEnabled:false,adIntervalSeconds:15,showAdOnEnd:false,minShortSeconds:1,maxShortSeconds:59};
export const seedDB:DB={users:[],contents:[],campaigns:[],wallets:{},settings:defaultSettings};
