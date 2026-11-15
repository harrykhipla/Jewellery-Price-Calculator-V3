import {kinds as appearances} from './detect.mjs';
export const categories=[...appearances,'Diamond','Cubic zirconia (CZ)','Pearl','Coloured stone','Other embellishment'];
export const reviewedKind=hit=>hit.confirmed??hit.kind;
export function assign(hits,indices,kind){
  if(!Number.isInteger(kind)||kind<0||kind>=categories.length)return hits;
  return hits.map((hit,i)=>indices.has(i)?{...hit,confirmed:kind}:hit);
}
