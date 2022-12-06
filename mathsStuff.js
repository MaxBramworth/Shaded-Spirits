import * as THREE from "./node_modules/three/build/three.module.js";

export function calcVectorPerpendicular(inpVector){
  const vect = new THREE.Vector3(inpVector.z, inpVector.y, -inpVector.x);
  return (vect);
}

export function distance(pointA, pointB){
  const A = (pointA.x - pointB.x) * (pointA.x - pointB.x);
  const B = (pointA.y - pointB.y) * (pointA.y - pointB.y);
  const C = (pointA.z - pointB.z) * (pointA.z - pointB.z);
  return Math.sqrt(A + B + C);
}

export function distance2D(pointA, pointB){
  const A = (pointA.x - pointB.x) * (pointA.x - pointB.x);
  const B = (pointA.y - pointB.y) * (pointA.y - pointB.y);
  return Math.sqrt(A + B);
}

export function arrayContains(array, item){ // not very mathsy but i can't think of a bette place to put it
  for(let i = 0; i < array.length; i++){
    if (array[i] == item){
      return true;
    }
  }
  return false;
}

export function arrayPosition(array, item){ // not very mathsy but i can't think of a bette place to put it
  for(let i = 0; i < array.length; i++){
    if (array[i] == item){
      return i;
    }
  }
  return -1;
}