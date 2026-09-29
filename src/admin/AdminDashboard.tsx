import React from 'react';import {dataProvider} from '@/services/dataProvider';export default function AdminDashboard(){
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-engage-style", "PAGE_CSS");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
const db=dataProvider.getDB();return <><div className="admin-head"><div><h1>Dashboard</h1><p>ENGAGE control center</p></div></div><div className="admin-stats"><div><b>{db.users.length}</b><span>Users</span></div><div><b>{db.contents.length}</b><span>Content</span></div><div><b>{db.campaigns.length}</b><span>Campaigns</span></div><div><b>{db.campaigns.filter(c=>c.status==='active').length}</b><span>Active</span></div></div><div className="admin-panel"><h2>Global Rules</h2><p>Reward: <b>{db.settings.rewardPerUser} coins/user</b></p><p>Campaign cost: <b>{db.settings.campaignCreationCost} coins</b></p><p>Ad popup: <b>every {db.settings.adIntervalSeconds}s playback</b></p></div></>}

/* ===== ADMINDASHBOARD CSS — kept inside this file ===== */
const PAGE_CSS = String.raw`
.admin-stats{
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.admin-stats b{
  display: block;
  font-size: 25px;
  color: #FF0000;
}

.admin-stats span{
  font-size: 10px;
  color: #777;
}

@media (max-width: 700px){.admin-stats{
    grid-template-columns: 1fr 1fr;
  }}
`;
