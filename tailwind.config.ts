import type { Config } from 'tailwindcss';
const config: Config = {content:['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],theme:{extend:{fontFamily:{sans:['Inter','ui-sans-serif','system-ui']},colors:{forge:{bg:'#07090f',panel:'#0d111c',line:'#232a3d',accent:'#8b5cf6',cyan:'#22d3ee'}},boxShadow:{glow:'0 0 60px rgba(139,92,246,.18)'}}},plugins:[]};
export default config;
