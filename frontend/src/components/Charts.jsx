import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function InventoryChart({ data }) {
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{top:8,right:4,left:-20,bottom:0}}><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b99b66" stopOpacity={.22}/><stop offset="95%" stopColor="#b99b66" stopOpacity={0}/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#aab8ad" stopOpacity={.18}/><stop offset="95%" stopColor="#aab8ad" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 5"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:11}} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:10}} tickFormatter={v=>`$${v}k`} ticks={[0,20,40,60,80]}/><Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,fontSize:12}} formatter={v=>[`$${v},000`,'Value']}/><Area type="monotone" dataKey="value" stroke="#b99b66" strokeWidth={2.4} fill="url(#g1)"/><Area type="monotone" dataKey="orders" stroke="#91a397" strokeWidth={2} fill="url(#g2)"/></AreaChart></ResponsiveContainer>
}
export function DistributionChart({ data }) {
  return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" innerRadius={68} outerRadius={88} paddingAngle={4} stroke="none">{data.map(c=><Cell key={c.name} fill={c.color}/>)}</Pie><Tooltip formatter={v=>`${v} units`}/></PieChart></ResponsiveContainer>
}
export function ReportChart({ data }) {
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid vertical={false} stroke="var(--grid)"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="value" fill="#b99b66" radius={[5,5,0,0]}/><Bar dataKey="orders" fill="#91a397" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>
}
