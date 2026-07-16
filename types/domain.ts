export type Repository = { id:string; name:string; url:string; framework:string; languages:string[]; dependencies:string[]; importedAt:string; summary:string };
export type TaskStatus = 'planned'|'running'|'testing'|'finished'|'failed';
export type TaskRun = { id:string; repoId:string; title:string; status:TaskStatus; plan:string[]; logs:string[]; filesChanged:string[]; tests:{passed:number;failed:number;coverage:number}; pr?:{title:string;body:string}; createdAt:string };
export type GraphNode = { id:string; label:string; type:'route'|'component'|'database'|'package'|'folder' };
export type GraphEdge = { id:string; source:string; target:string; label?:string };
