import * as THREE from "./node_modules/three/build/three.module.js";
import * as MATHS from "./mathsStuff.js";

let nodes = [];

class Node{
    constructor(_pos){
        this.pos = _pos;
        this.walkable = true;
        this.f = 0; // g + h (value of tile)
        this.g = 0; // path to start total distance
        this.h = 0; // distance to end (not as the crow flies)
        this.neighbours = [];
        nodes.push(this);
    }

    getCosts(startPos, endPos, inheritedGCost){
        this.g = inheritedGCost + MATHS.distance2D(new THREE.Vector2(this.pos.x, this.pos.z), new THREE.Vector2(startPos.x, startPos.z));
        const xdif = Math.abs(endPos.x - this.pos.x);
        const zdif = Math.abs(endPos.z - this.pos.z);
        this.h = Math.abs(xdif - zdif) + Math.min(xdif, zdif) * Math.SQRT2; // find out our weird A* distance
        this.f = this.g + this.h;
    }

    getNeighbours(){
        nodes.forEach(node => {
            if (MATHS.distance(node.pos, this.pos) < 1.5){
                this.neighbours.push(node);
            }
        });
    }
}

export function checkNodeWalkabilities(walls){
    nodes.forEach(node => {
        for (let i = 0; i < walls.length; i++){
            if (walls[i].boundingBox.containsPoint(node.pos)){
                node.walkable = false;
                i = walls.length; // no need to keep checking - this node isn't going to get unblocked
            }
        }
    });
}

export function genNodes(floors){
    console.log("generating nodes...");
    let startCorner = new THREE.Vector3(0, 0, 0);
    let nodeNo = 0;
    floors.forEach(floor => {
        startCorner = new THREE.Vector3(floor.boundingBox.min.x, floor.boundingBox.max.y + 0.02, floor.boundingBox.min.z);
        console.log(floor.cube.mesh.scale.x);
        for (let x = 0; x < floor.cube.mesh.scale.x; x++) {
            for (let z = 0; z < floor.cube.mesh.scale.z; z++) {
                nodes.push(new Node(new THREE.Vector3(startCorner.x + x, startCorner.y, startCorner.z + z)));
                console.log("created node at: " + nodes[nodes.length - 1].pos.x + ", " + nodes[nodes.length - 1].pos.y + ", " + nodes[nodes.length - 1].pos.z);
                nodeNo++;
            }
        }
    });
    console.log("finished making " + nodeNo + " nodes");
}

export function getNode(num){
    return nodes[num];
}

export function genNeighbours(){
    nodes.forEach(node => {
        node.getNeighbours();
    });
}