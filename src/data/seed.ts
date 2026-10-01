import type {DB,Content,Settings,MilestoneConfig} from '@/types';
import { DEFAULT_CAMPAIGN_PACKAGES } from '@/services/campaignPackages';
export const sampleVideoId='w9UVT95Wz2E';
export const seedContents:Content[]=[];
export const defaultSettings:Settings={autoplayEnabled: true,adEnabled:false,
  highRevenueBannerEnabled: false,
  profitablerSquareEnabled: false,monetagVignetteEnabled:false,monetagPushCreatedEnabled:false,monetagInPagePushEnabled:false,
  socialBarEnabled:false,adIntervalSeconds:15,showAdOnEnd:false,minShortSeconds:1,maxShortSeconds:59,
};
export const defaultMilestones:MilestoneConfig[]=[{id:'ms-50',views:50,rewardRupees:10,sortOrder:0,active:true},{id:'ms-100',views:100,rewardRupees:20,sortOrder:1,active:true}];
export const seedDB:DB={users:[],contents:[],campaigns:[],wallets:{},settings:defaultSettings,milestones:defaultMilestones,packages:DEFAULT_CAMPAIGN_PACKAGES};
