import type {DB,Content,Settings,MilestoneConfig} from '@/types';
export const sampleVideoId='w9UVT95Wz2E';
export const seedContents:Content[]=[];
export const defaultSettings:Settings={autoplayEnabled: true,adEnabled:false,
  highRevenueBannerEnabled: false,
  profitablerSquareEnabled: false,monetagVignetteEnabled:false,monetagPushCreatedEnabled:false,monetagInPagePushEnabled:false,
  socialBarEnabled:false,adIntervalSeconds:15,showAdOnEnd:false,minShortSeconds:1,maxShortSeconds:59,campaignPricePerView:0,campaignPricePerSecond:0.0266666667,
  campaignViewOptions:[10,25,50,100,250,500,1000],
  campaignWatchSecondOptions:[15,30,45,60],
};
export const defaultMilestones:MilestoneConfig[]=[{id:'ms-50',views:50,rewardRupees:10,sortOrder:0,active:true},{id:'ms-100',views:100,rewardRupees:20,sortOrder:1,active:true}];
export const seedDB:DB={users:[],contents:[],campaigns:[],wallets:{},settings:defaultSettings,milestones:defaultMilestones};
