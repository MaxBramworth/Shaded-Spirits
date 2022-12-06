import * as THREE from "three";
import { GLTFLoader } from "GLTFLoader";
import * as MATHS from "./mathsStuff.js";
import * as INPUTSYS from "./input.js";
import { Ray } from "./node_modules/three/build/three.module.js";

const FRAMETIME = 1/60;

const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

const scene = new THREE.Scene();

const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfdfbd3, 0.5);
sun.position.set(22, 35, -25);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  1,
  10000
);
//create the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xaaaaff, 1);
// Append the renderer canvas into <body>
document.body.appendChild(renderer.domElement);

//add the title text (deaths / saves / etc)
const titleText = document.createElement("h1");
titleText.textContent = "";
document.body.appendChild(titleText);

const healthBar = document.createElement("div");
document.body.appendChild(healthBar);

const healthBarBG = document.createElement("div");
document.body.appendChild(healthBarBG);
healthBarBG.style.backgroundColor = "darkred";
healthBarBG.style.zIndex = "10000";

const bosshealthBar = document.createElement("div");
document.body.appendChild(bosshealthBar);
bosshealthBar.style.top = "190%"; 
bosshealthBar.style.left = "80%";
bosshealthBar.style.width = "80%";
const bosshealthBarBG = document.createElement("div");
document.body.appendChild(bosshealthBarBG);
bosshealthBarBG.style.backgroundColor = "darkred";
bosshealthBarBG.style.zIndex = "10000";
bosshealthBarBG.style.top = "190%";
bosshealthBarBG.style.left = "80%";
bosshealthBarBG.style.width = "80%";
const bossName = document.createElement("h2");
document.body.appendChild(bossName);
bossName.style.top = "190%";
bossName.style.left = "20%";
bossName.innerHTML = "Ulurich, the Last King";

const TitleTextManager = {
  durationLeft: 0,
  totalDuration: 0,

  setTitle: function(text, duration){
    titleText.textContent = text;
    this.durationLeft = duration;
    this.totalDuration = duration;
  },
  update: function(){
    if(this.durationLeft > 0){
      this.durationLeft -= FRAMETIME;
      if (this.durationLeft < 1){
        titleText.style.opacity = this.durationLeft;
      } else if (this.totalDuration - this.durationLeft < 1){
        titleText.style.opacity = this.totalDuration - this.durationLeft;
      }
    } else{
      if (titleText.textContent == "You Died"){
        respawnPlayer();
      }
      titleText.textContent = "";
    }
  },
}

let playerWeapon;
loader.load("./bestbadgoofer.glb", function(gltf){
  playerWeapon = gltf.scene;
  gltf.scene.position.set(0, 0, 0);
  gltf.scene.rotation.set(0, 0, 0);
  gltf.scene.scale.set(0.5, 0.5, 1);
  scene.add(gltf.scene);
  models.push(gltf.scene);
});

class Combatant {
  constructor(model, hp, spd, detec, attacks, name, ai, spawnPos){
    this.name = name;
    this.model = model;
    this.hp = hp;
    this.speed = spd;
    this.attacks = attacks;
    this.state = "neutral";
    this.alerted = false;
    this.detectionDistance = detec;
    this.AI = ai;

    this.spawnPos = spawnPos;
    this.maxHP = this.hp;

    this.hurtTimer = 0;
    this.animationProgression = 0;
    this.facing = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.attackCD = 0;

    combatants.push(this);
  }

  hurt(damage, stun){
    this.hp -= damage;
    if (this.name == "player"){
      healthBar.style.width = (Math.max(this.hp * 5, 0)).toString() + "px";
      healthBar.style.left = (Math.max(this.hp * 4.5, 0) + 75).toString() + "px";
    }
    if (this.hp <= 0){
      console.log(this.name + " died");
      combatants.splice(MATHS.arrayPosition(combatants, this), 1);
      desceased.push(this);
      this.state == "dead";
      if (this.name == "player"){ //we need to reset everything
        TitleTextManager.setTitle("You Died", 5);
        animationLock = true;
      } else{
        this.model._pos.y = -500;
        this.model._model.position.y = -500;
        if (this.name == "Ulrulich, the Last King"){
          TitleTextManager.setTitle("King Slain", 7.5);
          bossName.style.top = "110%";
          bosshealthBar.style.top = "110%";
          bosshealthBarBG.style.top = "110%";
        }
      }
    } else{
      if (this.name != "Ulrulich, the Last King")
      {
        this.state = "stunned";
        this.hurtTimer = stun;
      } else {
        bosshealthBar.style.width = (Math.max(this.hp * 0.16, 0)).toString() + "%";
        bosshealthBar.style.left = (Math.max(this.hp * 0.144, 0) + 8).toString() + "%";
      }
    }
  }
  
  canSpotPlayer(playerPos, origin){
    this.alerted = true;
    const playerdist = MATHS.distance(origin, playerPos);
    if (playerdist > this.detectionDistance){
      this.alerted = false;
    } else{
      let dirToPlayer = new THREE.Vector3(playerPos.x - origin.x, playerPos.y - origin.y, playerPos.z - origin.z);
      dirToPlayer.normalize();
      const eyesight = new Ray(origin, dirToPlayer);
      collidableWalls.forEach(wall =>{
        if (eyesight.intersectsBox(wall.boundingBox) && MATHS.distance(wall.cube.mesh.position, origin) < playerdist){
          this.alerted = false;
       }
      })
    }
  }

  move(direction, distanceMin){
    if(this.state == "neutral" || this.state == "walking"){
      this.state = "walking";
      direction.y = 0;
      direction.normalize();
      if (direction.x > 0){
        if (direction.z > 0){
          this.model._model.rotation.set(0, Math.atan(direction.x / direction.z), 0);
        } else{
          this.model._model.rotation.set(0, Math.atan(direction.x / direction.z) + Math.PI, 0);
        }
      } else{
        if (direction.z > 0){
          this.model._model.rotation.set(0, Math.atan(direction.x / direction.z) + (2 * Math.PI), 0);
        } else{
          this.model._model.rotation.set(0, Math.atan(direction.x / direction.z) + Math.PI, 0);
        }
      }
      this.model._rot.set(0, this.model._model.rotation.y, 0);
      if (MATHS.distance(this.model._pos, playerModel.mesh.position) > distanceMin){
        this.model._pos.addVectors(direction.multiplyScalar(this.speed), this.model._pos);
        this.model._model.position.set(this.model._pos.x, this.model._pos.y, this.model._pos.z);
      }
    }
  }

  update(){
    this.state = "neutral";
    if (this.animationProgression > 0){
      this.state = "attacking";
    }
    if (this.hurtTimer > 0){
      this.state = "stunned";
      this.hurtTimer -= FRAMETIME;
    }
    if (this.attackCD > 0){
      this.attackCD -= FRAMETIME;
    }
    this.facing = new THREE.Vector3(Math.sin(this.model._rot.y), 0, Math.cos(this.model._rot.y));
    this.right = MATHS.calcVectorPerpendicular(this.facing);
  }

  revive(){
    console.log("reviving " + this.name);
    this.model._pos.set(this.spawnPos.x, this.spawnPos.y, this.spawnPos.z);
    this.model._model.position.set(this.spawnPos.x, this.spawnPos.y, this.spawnPos.z);
    this.hp = this.maxHP;
    this.state = "neutral";
    combatants.push(this);
  }
}

class attack {
  constructor(windup, duration, total_angle, hitbox_radius, hitbox_points, damage, stun, type_name, _model, needsreload, reloadsame){
    this.windUp = windup; // float time in animation before damage frames begin
    this.duration = duration; // float time of damage frames
    this.totalAngle = total_angle; // float total angle covered by attack, only used for sweep type attacks
    this.hitboxDRadius = hitbox_radius; // float, radius of hitboxes
    this.hitboxPoints = hitbox_points;
    this.damage = damage;
    this.stun = stun;
    this.hasHit = [];
    this.type = type_name;
    this._Points = [];
    this.model = _model; // a gltf scene
    if (needsreload){
      weaponsforReload.push(this);
    }
    this.reloadInSync = reloadsame;
  }

  reloadModel(newModel){
    this.model = newModel;
    if (this.reloadInSync != null){
      this.reloadInSync.model = newModel;
    }
  }

  attack(user_pos, user_rot, progression, offset, user_name){
    switch (this.type){
      case "sweep":
        this.sweep(user_pos, user_rot, progression, offset, user_name);
        break;
      case "stab":
        this.stab(user_pos, user_rot, progression, offset, user_name);
        break;
      case "gstab":
        this.gstab(user_pos, user_rot, progression, offset, user_name);
        break;
    }
  }

  sweep(user_pos, user_rot, progression, offset, user_name){ // called once per frame by attacking object
    const sweep_angle = ((progression - this.windUp) / this.duration) * this.totalAngle; 
    user_rot += sweep_angle - (this.totalAngle / 2); // rotate to angle
    const startVector = new THREE.Vector3(Math.sin(user_rot), 0, Math.cos(user_rot)); // create vector
    this._Points = [];
    this.hitboxPoints.forEach(point => {
      this._Points.push(new THREE.Vector3(user_pos.x + offset.x + startVector.x * point, user_pos.y + offset.y + startVector.y * point, user_pos.z + offset.z + startVector.z * point));
    })
    this.showWeapon(user_rot);
    this.checkCollision(user_name);
  }

  stab(user_pos, user_rot, progression, offset, user_name){
    const startVector = new THREE.Vector3(Math.sin(user_rot), 0, Math.cos(user_rot));
    const prog = ((progression - this.windUp) / this.duration) * this.totalAngle;
    this._Points = [];
    this.hitboxPoints.forEach(point => {
      this._Points.push(new THREE.Vector3(user_pos.x + offset.x + startVector.x * (point + prog), user_pos.y + startVector.y * (point + prog), user_pos.z + offset.z + startVector.z * (point + prog)));
    })
    this.showWeapon(user_rot);
    this.checkCollision(user_name);
  }

  gstab(user_pos, user_rot, progression, offset, user_name){
    this._Points = [];
    this.hitboxPoints.forEach(point => {
      this._Points.push(new THREE.Vector3(user_pos.x + offset.x, user_pos.y + offset.y - point * progression, user_pos.z + offset.z));
    })
    this.showWeapon(user_rot);
    this.checkCollision(user_name);
  }

  checkCollision(user_name){
    combatants.forEach(combatant => {
      this._Points.forEach(_point => {
        if (MATHS.distance2D(new THREE.Vector2(_point.x, _point.z), new THREE.Vector2(combatant.model._pos.x, combatant.model._pos.z)) < this.hitboxDRadius 
        && !MATHS.arrayContains(this.hasHit, combatant.name) && combatant.name != user_name){
          this.hasHit.push(combatant.name);
          combatant.hurt(this.damage, this.stun);
          console.log(combatant.name + " was injured! new health: " + combatant.hp.toString());
        }
      })
    })
    this._Points.forEach(point => {
      this._Points.pop(point);
    })
  }

  showWeapon(direction){
    this.model.position.set(this._Points[0].x, this._Points[0].y, this._Points[0].z);
    this.model.rotation.set(0, direction, 0);
  }

  prepareWeapon(a, b, c, d){
    switch (this.type){
      case "sweep":
        this.unsheath(a, b, c, d);
        break;
      case "stab":
        this.unsheath(a, b, c, d)
        break;
      case "gstab":
        break;
    }
  }

  unsheath(percentAnim, offset, position, rotation){
    this.model.position.set(position.x - (0.75 * offset.x), position.y - 0.35 + (percentAnim * 0.35), position.z - (offset.z * 0.75));
    this.model.rotation.set(rotation.x, rotation.y, rotation.z);
  }
}

const meleeSimple = {
  onUpdate: function(self){
    self.update();
    if (self.state == "attacking" && self.attackCD <= 0){
      if (self.animationProgression > self.attacks[0].windUp){
        self.attacks[0].attack(self.model._pos, self.model._rot.y, self.animationProgression, new THREE.Vector3(self.right.x * -0.15, 0, self.right.z * -0.15), self.name);
        if (self.animationProgression > self.attacks[0].duration + self.attacks[0].windUp){
          self.animationProgression = -FRAMETIME;
          self.state = "neutral";
          self.attackCD = 2.75;
        }
      } else{
        self.attacks[0].prepareWeapon(self.animationProgression / self.attacks[0].windUp, self.right.multiplyScalar(0.5), self.model._pos, self.model._rot);
      }
      self.animationProgression += FRAMETIME;
    }
  },
  whileAlerted: function(self){
    self.move(new THREE.Vector3(playerModel.mesh.position.x - self.model._pos.x, playerModel.mesh.position.y - self.model._pos.y, playerModel.mesh.position.z - self.model._pos.z), 2);
    if ((self.state == "neutral" || self.state == "walking") && self.attackCD <= 0 && MATHS.distance(self.model._pos, playerModel.mesh.position) < 2){
      self.state == "attacking";
      self.animationProgression = 0.001;
      self.attacks[0].hasHit.forEach(item => {
        self.attacks[0].hasHit.pop(item);
      })
    }
  }
}
const meleeGiant = {
  left: true,
  onUpdate: function(self){
    self.update();
    if (self.state == "attacking" && self.attackCD <= 0){
      if (self.animationProgression > self.attacks[0].windUp){
        if (this.left){
          self.attacks[0].attack(self.model._pos, self.model._rot.y, self.animationProgression, new THREE.Vector3(self.right.x * -0.45 + self.facing.x * 0.2, 0, self.right.z * -0.45 + self.facing.z * 0.2), self.name);
        } else{
          self.attacks[0].attack(new THREE.Vector3().addVectors(self.model._pos, self.right), self.model._rot.y + Math.PI * 0.75, -self.animationProgression, new THREE.Vector3(self.right.x * -0.45 + self.facing.x * 0.2, 0, self.right.z * -0.45 + self.facing.z * 0.2), self.name);
        }
        if (self.animationProgression > self.attacks[0].duration + self.attacks[0].windUp){
          self.animationProgression = -FRAMETIME;
          self.state = "neutral";
          if (this.left){
            self.attackCD = 0.75;
          } else {
            self.attackCD = 2.75;
          }
          this.left = !this.left;
        }
      } else{
        if (this.left){
          self.attacks[0].prepareWeapon(self.animationProgression / self.attacks[0].windUp, self.right.multiplyScalar(1.5), self.model._pos, self.model._rot);
        } else{
          self.attacks[0].prepareWeapon(self.animationProgression / self.attacks[0].windUp, self.right.multiplyScalar(1.5), new THREE.Vector3().addVectors(self.model._pos, self.right), self.model._rot);
        }
      }
      self.animationProgression += FRAMETIME;
    }
  },
  whileAlerted: function(self){
    self.move(new THREE.Vector3(playerModel.mesh.position.x - self.model._pos.x, playerModel.mesh.position.y - self.model._pos.y, playerModel.mesh.position.z - self.model._pos.z), 2);
    if ((self.state == "neutral" || self.state == "walking") && self.attackCD <= 0 && MATHS.distance(self.model._pos, playerModel.mesh.position) < 2){
      self.state == "attacking";
      self.animationProgression = 0.001;
      self.attacks[0].hasHit.forEach(item => {
        self.attacks[0].hasHit.pop(item);
      })
    }
  }
}
const fallenTemplar = {
  attack: 0,
  prevattack: 0,
  onUpdate: function(self){
    self.update();
    if (self.state == "attacking" && self.attackCD <= 0){
      if (self.animationProgression > self.attacks[this.attack].windUp){
        if (this.attack == 0){
          self.attacks[this.attack].attack(self.model._pos, self.model._rot.y, self.animationProgression, new THREE.Vector3(self.right.x * -0.45 + self.facing.x * 0.2, 0, self.right.z * -0.45 + self.facing.z * 0.2), self.name);
        }else{
          self.attacks[this.attack].attack(self.model._pos, self.model._rot.y, self.animationProgression, new THREE.Vector3(0 + self.facing.x * 0.2, 0, self.right.z * -0.45 + 0), self.name);
        }
        if (self.animationProgression > self.attacks[this.attack].duration + self.attacks[this.attack].windUp){
          self.animationProgression = -FRAMETIME;
          self.state = "neutral";
          self.attackCD = 1.75;
          this.left = !this.left;
        }
      } else{
        self.attacks[this.attack].prepareWeapon(self.animationProgression / self.attacks[this.attack].windUp, self.right.multiplyScalar(1.5), self.model._pos, self.model._rot);
      }
      self.animationProgression += FRAMETIME;
    }
  },
  whileAlerted: function(self){
    self.move(new THREE.Vector3(playerModel.mesh.position.x - self.model._pos.x, playerModel.mesh.position.y - self.model._pos.y, playerModel.mesh.position.z - self.model._pos.z), 2);
    if ((self.state == "neutral" || self.state == "walking") && self.attackCD <= 0 && MATHS.distance(self.model._pos, playerModel.mesh.position) < 3){
      if (this.attack == this.prevattack){
        this.prevattack = this.attack;
        this.attack = Math.abs(this.attack - 1);
      } else{
        this.prevattack = this.attack;
        this.attack = Math.floor(Math.random() * 2);
      }
      self.state == "attacking";
      self.animationProgression = 0.001;
      self.attacks[this.attack].hasHit.forEach(item => {
        self.attacks[this.attack].hasHit.pop(item);
      })
    }
  }
}
const LastKingAI = {
  attackPicked: 0,
  attackPatterns: [[0, 1, 0], [0, 2, 1], [1, 2], [2, 0]],
  atkPat: 0,
  atkPatPro: 0,
  onUpdate: function(self){
    self.update(); 
    if (self.state == "attacking" && self.attackCD <= 0){
      if (self.animationProgression > self.attacks[this.attackPicked].windUp){
        if (this.attackPicked == 0){ // if ground stab
          self.attacks[this.attackPicked].attack(self.model._pos, self.model._rot.y, self.animationProgression, new THREE.Vector3(self.facing.x * 1.75, 0, self.facing.z * 1.75), self.name);
        } else {
          self.attacks[this.attackPicked].attack(self.model._pos, self.model._rot.y, self.animationProgression, new THREE.Vector3(self.right.x * -0.15, 0, self.right.z * -0.15), self.name);
        }
        if (self.animationProgression > self.attacks[this.attackPicked].duration + self.attacks[this.attackPicked].windUp){
          self.animationProgression = -FRAMETIME;
          self.state = "neutral";
          if (this.atkPatPro == this.attackPatterns[this.atkPat].length - 1){
            self.attackCD = 3;
          } else {
            self.attackCD = 1;
          }
        }
      } else{
        self.attacks[this.attackPicked].prepareWeapon(self.animationProgression / self.attacks[this.attackPicked].windUp, self.right.multiplyScalar(0.5), self.model._pos, self.model._rot);
      }
      self.animationProgression += FRAMETIME;
    }
  },
  whileAlerted: function(self){
    self.move(new THREE.Vector3(playerModel.mesh.position.x - self.model._pos.x, playerModel.mesh.position.y - self.model._pos.y, playerModel.mesh.position.z - self.model._pos.z), 2);
    if ((self.state == "neutral" || self.state == "walking") && self.attackCD <= 0 && MATHS.distance(self.model._pos, playerModel.mesh.position) < 3){
      self.state == "attacking";
      self.animationProgression = 0.001;
      this.atkPatPro++;
      if (this.atkPatPro == this.attackPatterns[this.atkPat].length){
        this.atkPatPro = 0;
        this.atkPat = Math.floor(Math.random() * 4);
      }
      this.attackPicked = this.attackPatterns[this.atkPat][this.atkPatPro];
      self.attacks[this.attackPicked].hasHit.forEach(item => {
        self.attacks[this.attackPicked].hasHit.pop(item);
      })
    }
  }
}

const bad_goofer_light = new attack(0.25, 0.5, Math.PI / 2, 0.35, [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], 15, 0.5, "sweep", playerWeapon);
const bad_goofer_heavy = new attack(1.5, 0.5, Math.PI / 2, 0.45, [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], 35, 1.5, "stab", playerWeapon);

let grounded = false;
let PlayerFacing = new THREE.Vector3(0, 0, 0);
let PlayerRight = new THREE.Vector3(0, 0, 0);
const moveSpeed = 0.07;
let run = 0;
let gravity = -0.2;
let airTime = 0;
let roll = 0;
const rollSpeed = 0.2;
let camHeight = 2;
let playerState = "neutral"; //neutral, roll, jump, fall, walk, run, light attack, heavy attack, block, stunned
let animationProgression = 0;
let animationLock = false;
let respawnStandard;

let collidableWalls = [];
let collidableModels = [];
let combatants = [];
let desceased = [];
let models = [];
let respawnPoints = [];
let Levers = [];
let weaponsforReload = [];
let weaponModelsForReload = [];
let leversPulled = 0;

class wall {
  constructor(_pos, _rot, _scale, _eje, _isfloor, materialPathway, _isTrigger){
    this.cube = {
      geometry: new THREE.BoxGeometry(1, 1, 1), 
      material: [
        new THREE.MeshStandardMaterial({ map: texLoader.load(materialPathway)}),
        new THREE.MeshStandardMaterial({ map: texLoader.load(materialPathway)}),
        new THREE.MeshStandardMaterial({ map: texLoader.load(materialPathway)}),
        new THREE.MeshStandardMaterial({ map: texLoader.load(materialPathway)}),
        new THREE.MeshStandardMaterial({ map: texLoader.load(materialPathway)}),
        new THREE.MeshStandardMaterial({ map: texLoader.load(materialPathway)})
      ]
    };
    this.cube.mesh = new THREE.Mesh(this.cube.geometry, this.cube.material);
    this.ejectionDirection = _eje; // direction player gets pushed upon colliding. Should be small e.g. 0.1 - 0 - 0.1
    this.isFloor = _isfloor; // floors allow the player to become grounded again
    this.cube.mesh.position.set(_pos.x, _pos.y, _pos.z);
    this.cube.mesh.rotation.set(_rot.x, _rot.y, _rot.z);
    this.cube.mesh.scale.set(_scale.x, _scale.y, _scale.z);
    this.cube.mesh.castShadow = true;
    this.cube.mesh.recieveShadow = true;
    this.isTrigger = _isTrigger;
    this.activated = false;
    if (this.isTrigger != null){
      this.cube.mesh.visible = false;
    }
  }
  existify(){
    scene.add(this.cube.mesh);

    this.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
    this.boundingBox.setFromObject(this.cube.mesh);

    collidableWalls.push(this);
  }
  reexisify(){
    collidableWalls.push(this);
  }
}

class THREEDModel {
  constructor(_pos, _rot, _scale, hitboxRadius, hitboxHeight, modelPathway, needsreload){
    this.modelPathway = modelPathway;
    this._pos = new THREE.Vector3(_pos.x, _pos.y, _pos.z);
    this._rot = new THREE.Vector3(_rot.x, _rot.y, _rot.z);
    this._scale = new THREE.Vector3(_scale.x, _scale.y, _scale.z);
    this.hitbox = {
      height: hitboxHeight,
      radius: hitboxRadius,
    };
    this._model = playerWeapon;
    if (needsreload){
      weaponModelsForReload.push(this);
    }
  }

  load(){
    const pos = new THREE.Vector3(this._pos.x, this._pos.y, this._pos.z);
    const rot = new THREE.Vector3(this._rot.x, this._rot.y, this._rot.z);
    const scale = new THREE.Vector3(this._scale.x, this._scale.y, this._scale.z);

    collidableModels.push(this);
    const CMindex = collidableModels.length - 1;
    
    loader.load(this.modelPathway, function(gltf){
      gltf.scene.position.set(pos.x, pos.y, pos.z);
      gltf.scene.rotation.set(rot.x, rot.y, rot.z);
      gltf.scene.scale.set(scale.x, scale.y, scale.z);
      scene.add(gltf.scene);
      models.push(gltf.scene);
      bounceBackGLTFScene(gltf.scene, CMindex);
    });
  }

  reloadHitbox(){
    collidableModels.push(this);
  }

  set_Model(modul){
    this._model = modul;
  }
}

class structure {
  constructor(_objects, _models, _interractables){
    this.objects = _objects;
    this.models = _models;
  }

  load(){
    this.objects.forEach(obj => {
      obj.existify();
    })
    this.models.forEach(obj => {
      obj.load();
    })
  }

  loadHitboxes(){
    this.objects.forEach(obj => {
      obj.reexistify();
    })
    this.models.forEach(obj => {
      obj.reloadHitbox();
    })
  }
}

class interractableObject{ // literally exists only to be inherited
  constructor(_model, _range, text){
    this.model = _model; // the whole aah THREEDModel
    this.range = _range;
    this.canBeInterracted;
    this.tip = text;
  }

  checkInRange(){
    if (MATHS.distance(this.model._pos, playerModel.mesh.position) < this.range){
      this.canBeInterracted = true;
    } else{
      this.canBeInterracted = false;
    }
  }
}

class respawnPoint extends interractableObject {
  constructor(_model, _range, text, _encounters, resPoint){
    super(_model, _range, text);
    this.playerSpawningAt = false;
    this.encounters = _encounters; // list of structures
    this.respawnPoint = resPoint;
    respawnPoints.push(this);
  }

  save(){
    this.checkInRange();
    if (this.canBeInterracted){
      respawnStandard = this;
      playerCombatant.hp = 100;
      healthBar.style.left = "525px";
      healthBar.style.width = "500px";
      console.log("saved spawn at: (" + this.respawnPoint.x.toString() + ", " + this.respawnPoint.y.toString() + ", " + this.respawnPoint.z.toString() + ")");
      TitleTextManager.setTitle("Banner Marked", 3);
    }
  }
}

class lever extends interractableObject {
  constructor(_model, _rangle, text){
    super(_model, _rangle, text);
    this.activated = false;
    Levers.push(this);
  }

  pull(){
    this.checkInRange();
    if (this.canBeInterracted && !this.activated){
      leversPulled++;
      this.activated = true;
      TitleTextManager.setTitle(leversPulled.toString() + "/2", 3);
      this.model._model.rotation.y += Math.PI;
      if (leversPulled == 2){
        OpenGate("boss");
      } else if (leversPulled == 1){
        OpenGate("birm");
      }
    }
  }
}

const modelPlayer = new THREEDModel(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(1.2, 1.2, 1.2), 0.5, 2, "./scene.gltf");
const playerCombatant = new Combatant(modelPlayer, 100, 0.1, 0, [bad_goofer_light, bad_goofer_heavy], "player", "", new THREE.Vector3(0, 0, 0));
modelPlayer.load();

const playerModel = {
  geometry: new THREE.BoxGeometry(1, 1, 1),
  material: new THREE.MeshBasicMaterial( 0xff0000 ),
};
playerModel.mesh = new THREE.Mesh(playerModel.geometry, playerModel.material);
playerModel.mesh.scale.set(1, 2, 1);
playerModel.mesh.visible = false;
let playerBoundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
playerBoundingBox.setFromObject(playerModel.mesh);
scene.add(playerModel.mesh);

camera.position.x = playerModel.mesh.position.x;
camera.position.y = playerModel.mesh.position.y + 1;
camera.position.z = playerModel.mesh.position.z - 5;

const swamp_water = {
  geometry: new THREE.BoxGeometry(100, 1, 100),
  material: [
    new THREE.MeshStandardMaterial({ map: texLoader.load("./murkywater.png")}),
    new THREE.MeshStandardMaterial({ map: texLoader.load("./murkywater.png")}),
    new THREE.MeshStandardMaterial({ map: texLoader.load("./murkywater.png")}),
    new THREE.MeshStandardMaterial({ map: texLoader.load("./murkywater.png")}),
    new THREE.MeshStandardMaterial({ map: texLoader.load("./murkywater.png")}),
    new THREE.MeshStandardMaterial({ map: texLoader.load("./murkywater.png")})
  ]
};
swamp_water.mesh = new THREE.Mesh(swamp_water.geometry, swamp_water.material);
swamp_water.mesh.position.set(-38, -2.1, 40);
scene.add(swamp_water.mesh);

const starting_island_Greymarsh = new structure([
  new wall(new THREE.Vector3(-5, -1, 10), new THREE.Vector3(0, 0, 0), new THREE.Vector3(30, 1, 35), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //floor
  new wall(new THREE.Vector3(-5, 2, 10), new THREE.Vector3(0, 0, 0), new THREE.Vector3(30, 1, 35), new THREE.Vector3(0, 0.01, 0), false, "./grassig.png", "Greymarsh"), //area trigger
  new wall(new THREE.Vector3(-5, 1, -10), new THREE.Vector3(0, 0, 0), new THREE.Vector3(35, 8, 5), new THREE.Vector3(0, 0, 0.02), false, "./rock.png"), // behind wall
  new wall(new THREE.Vector3(-40, 1, -10), new THREE.Vector3(0, 0, 0), new THREE.Vector3(35, 8, 5), new THREE.Vector3(0, 0, 0.02), false, "./rock.png"), // behind wall
  new wall(new THREE.Vector3(-75, 1, -10), new THREE.Vector3(0, 0, 0), new THREE.Vector3(35, 8, 5), new THREE.Vector3(0, 0, 0.02), false, "./rock.png"), // behind wall
  new wall(new THREE.Vector3(15.25, 2.2, 10), new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 6, 35), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), // platform on left wall
  new wall(new THREE.Vector3(15.25, 3.2, 10), new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 6, 35), new THREE.Vector3(0, 0.01, 0), false, "./grassig.png", "Minch Common"),
  new wall(new THREE.Vector3(12.5, 1, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 8, 65), new THREE.Vector3(-0.02, 0, 0), false, "./rock.png"), // left wall
  new wall(new THREE.Vector3(9.5, 1, 15), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0.5, 2), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), // slope left wall
  new wall(new THREE.Vector3(9.5, 1.5, 17), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0.5, 2), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), // slope left wall
  new wall(new THREE.Vector3(9.5, 2, 19), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0.5, 2), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), // slope left wall
  new wall(new THREE.Vector3(9.5, 2.5, 21), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0.5, 2), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), // slope left wall
  new wall(new THREE.Vector3(-2.5, -1.5, 10), new THREE.Vector3(0, 0, 0), new THREE.Vector3(40, 1, 40), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //slope to swamp
  new wall(new THREE.Vector3(-5, -2, 12.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(42.5, 1, 42.5), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //slope to swamp
  new wall(new THREE.Vector3(-38, -2.5, 40), new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 1, 100), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //swamp floor
  new wall(new THREE.Vector3(22.25, 8, 10), new THREE.Vector3(0, 0, -0.1), new THREE.Vector3(4, 6, 45), new THREE.Vector3(-0.02, 0, 0), false, "./rock.png"), //left minch common
  new wall(new THREE.Vector3(10.25, 8, -8.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 6, 4), new THREE.Vector3(0, 0, 0.02), false, "./rock.png"), // behind minch common
  new wall(new THREE.Vector3(15.25, 8, 29.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 6, 4), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), // behind minch common
], [
  new THREEDModel(new THREE.Vector3(1, -0.5, 0), new THREE.Vector3(0, Math.PI, 0), new THREE.Vector3(0.2, 0.2, 0.2), 0.15, 2, "./red standard.glb"),
]);

const mcdonalds_Greymarsh = new structure([
  new wall(new THREE.Vector3(-42, -0.1, 32), new THREE.Vector3(0, 0, 0), new THREE.Vector3(9, 3, 0.1), new THREE.Vector3(0, 0, 0.02), false, "./wood.png"), // north wall
  new wall(new THREE.Vector3(-42, -0.1, 31.8), new THREE.Vector3(0, 0, 0), new THREE.Vector3(8.7, 3, 0.1), new THREE.Vector3(0, 0, -0.02), false, "./wood.png"), 
  new wall(new THREE.Vector3(-42, -0.1, 24.2), new THREE.Vector3(0, 0, 0), new THREE.Vector3(8.8, 3, 0.1), new THREE.Vector3(0, 0, 0.02), false, "./wood.png"), // south wall
  new wall(new THREE.Vector3(-42, -0.1, 24), new THREE.Vector3(0, 0, 0), new THREE.Vector3(9, 3, 0.1), new THREE.Vector3(0, 0, -0.02), false, "./wood.png"),
  new wall(new THREE.Vector3(-37.5, -0.1, 28), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(8, 3, 0.1), new THREE.Vector3(0.02, 0, 0.), false, "./wood.png"), // east wall
  new wall(new THREE.Vector3(-37.7, -0.1, 28), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(7.8, 3, 0.1), new THREE.Vector3(-0.02, 0, 0), false, "./wood.png"),
  new wall(new THREE.Vector3(-46.5, -0.1, 30.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(3.5, 3, 0.1), new THREE.Vector3(-0.02, 0, 0.), false, "./wood.png"), // west wall
  new wall(new THREE.Vector3(-46.3, -0.1, 30.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(3.4, 3, 0.1), new THREE.Vector3(0.02, 0, 0), false, "./wood.png"),
  new wall(new THREE.Vector3(-46.5, -0.1, 25.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(2.5, 3, 0.1), new THREE.Vector3(-0.02, 0, 0.), false, "./wood.png"),
  new wall(new THREE.Vector3(-46.3, -0.1, 25.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(2.4, 3, 0.1), new THREE.Vector3(0.02, 0, 0), false, "./wood.png"),
  new wall(new THREE.Vector3(-46.4, -0.1, 28.525), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 3, 0.1), new THREE.Vector3(0, 0, -0.02), false, "./wood.png"), // seal off the wall loops
  new wall(new THREE.Vector3(-46.4, -0.1, 26.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 3, 0.1), new THREE.Vector3(0, 0, 0.02), false, "./wood.png"),
], [
  new THREEDModel(new THREE.Vector3(-62, -2, 10), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 1, 1), 0.5, 15, "./tree.glb"),
  new THREEDModel(new THREE.Vector3(-43, -2, 40), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1), 0.5, 15, "./tree.glb"),
  new THREEDModel(new THREE.Vector3(-40, -2, 28), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0.5, 0.5), 0.5, 15, "./lever.glb")
]);

const second_island_Greymarsh = new structure([
  new wall(new THREE.Vector3(-25, -2, 80), new THREE.Vector3(0, 0, 0), new THREE.Vector3(30, 1, 35), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //floor
  new wall(new THREE.Vector3(-30, -1.5, 90), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 1, 15), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //slope1
  new wall(new THREE.Vector3(-25, -1, 90), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 1, 15), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //slope2
  new wall(new THREE.Vector3(-20, -0.5, 90), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 1, 15), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //slope3
  new wall(new THREE.Vector3(-15, 0, 90), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 1, 15), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //slope4
  new wall(new THREE.Vector3(0, 0.5, 90), new THREE.Vector3(0, 0, 0), new THREE.Vector3(25, 1, 15), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //top floor
  new wall(new THREE.Vector3(-25, -2.1, 82.9), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 3, 1), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), //slope2wall
  new wall(new THREE.Vector3(-20, -1.6, 82.9), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 3, 1), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), //slope3wall
  new wall(new THREE.Vector3(-15, -1.1, 82.9), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 3, 1), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), //slope4wall
  new wall(new THREE.Vector3(-6.25, -0.6, 82.9), new THREE.Vector3(0, 0, 0), new THREE.Vector3(12.5, 3, 1), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), //top floor wall1
  new wall(new THREE.Vector3(6.25, -0.6, 82.9), new THREE.Vector3(0, 0, 0), new THREE.Vector3(12.5, 3, 1), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), //top floor wall2
  new wall(new THREE.Vector3(12.5, 1, 80), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 8, 35), new THREE.Vector3(-0.02, 0, 0), false, "./rock.png"), // wall by gate to Toronto
], [
  new THREEDModel(new THREE.Vector3(-5, -1.5, 60), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1), 0.5, 15, "./tree.glb"),
  new THREEDModel(new THREE.Vector3(1, 2, 92), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 1, 1), 0.5, 15, "./tree.glb"),
])

const random_island_Greymarsh = new structure([
  new wall(new THREE.Vector3(-90, 1, 10), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 8, 45), new THREE.Vector3(0.02, 0, 0), false, "./rock.png"), // right wall
  new wall(new THREE.Vector3(-90, 1, 55), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 8, 45), new THREE.Vector3(0.02, 0, 0), false, "./rock.png"),
  new wall(new THREE.Vector3(-90, 1, 85), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 8, 15), new THREE.Vector3(0.02, 0, 0), false, "./rock.png"),
  new wall(new THREE.Vector3(-80, -2, 60), new THREE.Vector3(0, 0, 0), new THREE.Vector3(15, 1, 20), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"),
  new wall(new THREE.Vector3(-5, 1, 100), new THREE.Vector3(0, 0, 0), new THREE.Vector3(35, 8, 5), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), // far wall left
  new wall(new THREE.Vector3(-40, 1, 90), new THREE.Vector3(0, 0, 0), new THREE.Vector3(35, 8, 2), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), // far wall mid
  new wall(new THREE.Vector3(-44, 1, 92), new THREE.Vector3(0, 0, 0), new THREE.Vector3(41, 8, 2), new THREE.Vector3(0, 0, 0.02), false, "./rock.png"), // far wall mid back
  new wall(new THREE.Vector3(-22.9, 1, 91), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 8, 3.9), new THREE.Vector3(0.02, 0, 0), false, "./rock.png"), // far wall secret wall seal
  new wall(new THREE.Vector3(-75, 1, 91), new THREE.Vector3(0, 0, 0), new THREE.Vector3(35, 8, 3), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), // far wall right
  new wall(new THREE.Vector3(-40, 1, 100), new THREE.Vector3(0, 0, 0), new THREE.Vector3(35, 8, 5), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), // far wall right secret
], [])

const entrance_hall_Immortal_Keep = new structure([
  new wall(new THREE.Vector3(50, 1.4, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 4, 6), new THREE.Vector3(-0.02, 0, 0), false, "./badtexture.png", "inv"), // portcullis wall
  new wall(new THREE.Vector3(14, -3.5, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 4, 10), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"),// slope to hall
  new wall(new THREE.Vector3(19, -3.25, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 4, 10), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"),// slope to hall
  new wall(new THREE.Vector3(24, -3, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 4, 10), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"),// slope to hall
  new wall(new THREE.Vector3(29, -2.75, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 4, 10), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"),// slope to hall
  new wall(new THREE.Vector3(34, -2.5, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 4, 10), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"),// slope to hall
  new wall(new THREE.Vector3(39, -2.25, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 4, 10), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"),// slope to hall
  new wall(new THREE.Vector3(37, 3, 50.5), new THREE.Vector3(-0.2, 0, 0), new THREE.Vector3(45, 10, 4), new THREE.Vector3(0, 0, 0.01), false, "./rock.png"),// left hand cliff
  new wall(new THREE.Vector3(37, 3, 64.5), new THREE.Vector3(0.2, 0, 0), new THREE.Vector3(45, 10, 4), new THREE.Vector3(0, 0, -0.01), false, "./rock.png"),// right hand cliff
  new wall(new THREE.Vector3(71.5, -2, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 7), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), // main hall floor
  new wall(new THREE.Vector3(51.5, -2, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 7), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), // main hall floor
  new wall(new THREE.Vector3(71.5, 8, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 20), new THREE.Vector3(0, -0.01, 0), false, "./badtexture.png"), // main hall roof
  new wall(new THREE.Vector3(55.5, 8, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(12, 4, 20), new THREE.Vector3(0, -0.01, 0), false, "./badtexture.png"), // main hall roof
  new wall(new THREE.Vector3(54, 0.8, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 4, 6), new THREE.Vector3(0, 0, 0), false, "./badtexture.png", "Undying Keep"), // area trigger
  new wall(new THREE.Vector3(82.5, 2.8, 55.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 6.6, 20), new THREE.Vector3(-0.02, 0, 0), false, "./badtexture.png"), // back wall
  new wall(new THREE.Vector3(82.5, 2.8, 35.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 6.6, 20), new THREE.Vector3(-0.02, 0, 0), false, "./badtexture.png"), // back wall
  new wall(new THREE.Vector3(61.5, 2.8, 52), new THREE.Vector3(0, 0, 0), new THREE.Vector3(23.9, 6.6, 5.5), new THREE.Vector3(0, 0, 0.02), false, "./badtexture.png"), // main hall left
  new wall(new THREE.Vector3(61.5, 2.8, 63), new THREE.Vector3(0, 0, 0), new THREE.Vector3(23.9, 6.6, 5.5), new THREE.Vector3(0, 0, -0.02), false, "./badtexture.png"), 
], [
  new THREEDModel(new THREE.Vector3(50, 0.8, 57.5), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(0.3, 0.2, 0.3), 0.5, 15, "./portcullis.glb"),
])

const boss_Immortal_Keep = new structure([
  new wall(new THREE.Vector3(71.55, 2.8, 40.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 6.6, 28), new THREE.Vector3(0.02, 0, 0), false, "./badtexture.png"), // left wall 2nd cori
  new wall(new THREE.Vector3(71.55, 2.8, 63), new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 6.6, 4), new THREE.Vector3(0.02, 0, 0), false, "./badtexture.png"), // banner right
  new wall(new THREE.Vector3(77, 2.8, 66.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(17, 6.6, 4), new THREE.Vector3(0, 0, -0.02), false, "./badtexture.png"), // banner back
  new wall(new THREE.Vector3(77, -2, 63), new THREE.Vector3(0, 0, 0), new THREE.Vector3(7, 4, 4), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), // banner floor
  new wall(new THREE.Vector3(77, -2, 40), new THREE.Vector3(0, 0, 0), new THREE.Vector3(7, 4, 28), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), // coridoor floor
  new wall(new THREE.Vector3(77, 8, 40), new THREE.Vector3(0, 0, 0), new THREE.Vector3(7, 4, 28), new THREE.Vector3(0, -0.01, 0), false, "./badtexture.png"), //coridoor roof
  new wall(new THREE.Vector3(77, -2, -4), new THREE.Vector3(0, 0, 0), new THREE.Vector3(60, 4, 60), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), // boss hall floor
  new wall(new THREE.Vector3(77, 2.8, 28), new THREE.Vector3(0, 0, 0), new THREE.Vector3(17, 6.6, 4), new THREE.Vector3(0, 0, -0.02), false, "./badtexture.png", "bossBar"), // boss trigger
  new wall(new THREE.Vector3(77, 4, -34), new THREE.Vector3(0, 0, 0), new THREE.Vector3(60, 8, 1), new THREE.Vector3(0, 0, 0.02), false, "./badtexture.png"), // boss hall far wall
  new wall(new THREE.Vector3(60, 4, 26), new THREE.Vector3(0, 0, 0), new THREE.Vector3(25, 8, 1), new THREE.Vector3(0, 0, -0.02), false, "./badtexture.png"), // boss hall back wall left
  new wall(new THREE.Vector3(94, 4, 25.9), new THREE.Vector3(0, 0, 0), new THREE.Vector3(25, 8, 1), new THREE.Vector3(0, 0, -0.02), false, "./badtexture.png"), // boss hall back wall right
  new wall(new THREE.Vector3(47, 4, -4), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 8, 60), new THREE.Vector3(0.02, 0, 0), false, "./badtexture.png"), // boss hall left wall
  new wall(new THREE.Vector3(107, 4, -4), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 8, 60), new THREE.Vector3(-0.02, 0, 0), false, "./badtexture.png"), // boss hall right wall
], [
  new THREEDModel(new THREE.Vector3(77, 0, 63.5), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(0.2, 0.2, 0.2), 0.15, 2, "./red standard.glb")
])

const Fallen_Capitalentrance = new structure([
  new wall(new THREE.Vector3(-61.1, 1.4, 100), new THREE.Vector3(0, 0, 0), new THREE.Vector3(9, 1, 10), new THREE.Vector3(0, 0.01, 0), true, "./grassig.png"), //banner platform
  new wall(new THREE.Vector3(-61.1, 4.4, 105), new THREE.Vector3(0, 0, 0), new THREE.Vector3(9, 6, 1), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), //wall far
  new wall(new THREE.Vector3(-64.1, 4.4, 102), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 6, 8), new THREE.Vector3(0.02, 0, 0), false, "./rock.png"), //wall left
  new wall(new THREE.Vector3(-58.1, 4.4, 102), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 6, 8), new THREE.Vector3(-0.02, 0, 0), false, "./rock.png"), //wall left
  new wall(new THREE.Vector3(-40, -1.5, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope
  new wall(new THREE.Vector3(-43, -1, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope
  new wall(new THREE.Vector3(-46, -0.5, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope
  new wall(new THREE.Vector3(-49, -0, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope
  new wall(new THREE.Vector3(-52, 0.5, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope
  new wall(new THREE.Vector3(-55, 1, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope
  new wall(new THREE.Vector3(-58, 1.5, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope
  new wall(new THREE.Vector3(-61, 2, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope
  new wall(new THREE.Vector3(-64, 2.5, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope
  new wall(new THREE.Vector3(-66, 5, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 5), new THREE.Vector3(0.02, 0, 0), false, "./badtexture.png", "inv"), //gate
  new wall(new THREE.Vector3(-77, 3, 105), new THREE.Vector3(0, 0, 0), new THREE.Vector3(23, 1, 25), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance platform
  new wall(new THREE.Vector3(-77, 6, 117.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(23, 5, 1), new THREE.Vector3(0, 0, -0.02), false, "./badtexture.png"), //left wall
  new wall(new THREE.Vector3(-77, 6, 93.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(23, 5, 3), new THREE.Vector3(0, 0, 0.02), false, "./badtexture.png"), //right wall
  new wall(new THREE.Vector3(-65.5, 6, 108), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 5, 22), new THREE.Vector3(-0.02, 0, 0), false, "./badtexture.png"), //close wall
  new wall(new THREE.Vector3(-88.5, 6, 102), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 5, 22), new THREE.Vector3(0.02, 0, 0), false, "./badtexture.png"), //far wall
  new wall(new THREE.Vector3(-85.5, 3.5, 115), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope 2
  new wall(new THREE.Vector3(-88.5, 4, 115), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope 2
  new wall(new THREE.Vector3(-91.5, 4.5, 115), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //entrance slope 2
], [
  new THREEDModel(new THREE.Vector3(-61, 2, 100), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(0.2, 0.2, 0.2), 0.15, 2, "./red standard.glb"),
  new THREEDModel(new THREE.Vector3(-66, 4, 96), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(0.1, 0.15, 0.1), 0.5, 15, "./portcullis.glb"),
])

const Fallen_Capitalmain = new structure([
  new wall(new THREE.Vector3(-91.5, 5.5, 115), new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 1, 5), new THREE.Vector3(0, 0.01, 0), false, "./badtexture.png", "Fallen Capital"), //trigger
  new wall(new THREE.Vector3(-118, 5, 100), new THREE.Vector3(0, 0, 0), new THREE.Vector3(50, 1, 50), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //platform
  new wall(new THREE.Vector3(-143, 7, 75), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 5, 100), new THREE.Vector3(0.02, 0, 0), false, "./badtexture.png", "inv"),
  new wall(new THREE.Vector3(-118, 5, 50), new THREE.Vector3(0, 0, 0), new THREE.Vector3(50, 1, 50), new THREE.Vector3(0, 0.01, 0), true, "./badtexture.png"), //platform 2
  new wall(new THREE.Vector3(-118, 10, 90), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 10, 10), new THREE.Vector3(0.02, 0, 0), false, "./badtexture.png", "inv"),
  new wall(new THREE.Vector3(-123, 10, 85), new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 1), new THREE.Vector3(0, 0, -0.02), false, "./badtexture.png", "inv"),
  new wall(new THREE.Vector3(-109, 9, 126), new THREE.Vector3(0, 0, 0), new THREE.Vector3(64, 10, 15), new THREE.Vector3(0, 0, -0.02), false, "./rock.png"), //back wall
  new wall(new THREE.Vector3(-91, 7, 87.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(4.5, 5, 50), new THREE.Vector3(-0.02, 0, 0), false, "./rock.png"), // right wall
], [
  new THREEDModel(new THREE.Vector3(-143, 10, 65), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false), // house wall left
  new THREEDModel(new THREE.Vector3(-143, 10, 55), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-143, 10, 45), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-143, 10, 75), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-143, 10, 35), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-143, 10, 25), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-143, 10, 85), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-143, 10, 95), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-138, 10, 25), new THREE.Vector3(0, Math.PI / -2, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false), // house all far
  new THREEDModel(new THREE.Vector3(-128, 10, 25), new THREE.Vector3(0, Math.PI / -2, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-118, 10, 25), new THREE.Vector3(0, Math.PI / -2, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-108, 10, 25), new THREE.Vector3(0, Math.PI / -2, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-98, 10, 25), new THREE.Vector3(0, Math.PI / -2, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false),
  new THREEDModel(new THREE.Vector3(-123, 10, 95), new THREE.Vector3(0, Math.PI / -2, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false), // random house close
  new THREEDModel(new THREE.Vector3(-123, 10, 85), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(0.3, 0.4, 0.3), 0, 0, "./birmingham residence.glb", false), // random house far
])

const mcdonaldsFallen_Capital = new structure([
  new wall(new THREE.Vector3(-100, 8.2, 62), new THREE.Vector3(0, 0, 0), new THREE.Vector3(25, 5, 0.1), new THREE.Vector3(0, 0, 0.02), false, "./wood.png"), // north wall
  new wall(new THREE.Vector3(-100, 8.2, 61.8), new THREE.Vector3(0, 0, 0), new THREE.Vector3(24.7, 5, 0.1), new THREE.Vector3(0, 0, -0.02), false, "./wood.png"), 
  new wall(new THREE.Vector3(-100, 8.2, 54.2), new THREE.Vector3(0, 0, 0), new THREE.Vector3(24.8, 5, 0.1), new THREE.Vector3(0, 0, 0.02), false, "./wood.png"), // south wall
  new wall(new THREE.Vector3(-100, 8.2, 54), new THREE.Vector3(0, 0, 0), new THREE.Vector3(25, 5, 0.1), new THREE.Vector3(0, 0, -0.02), false, "./wood.png"),
  new wall(new THREE.Vector3(-112.5, 8.2, 60.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(3.5, 5, 0.1), new THREE.Vector3(-0.02, 0, 0.), false, "./wood.png"), // west wall
  new wall(new THREE.Vector3(-112.3, 8.2, 60.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(3.4, 5, 0.1), new THREE.Vector3(0.02, 0, 0), false, "./wood.png"),
  new wall(new THREE.Vector3(-112.5, 8.2, 55.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(2.5, 5, 0.1), new THREE.Vector3(-0.02, 0, 0.), false, "./wood.png"),
  new wall(new THREE.Vector3(-112.3, 8.2, 55.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(2.4, 5, 0.1), new THREE.Vector3(0.02, 0, 0), false, "./wood.png"),
  new wall(new THREE.Vector3(-87.7, 8.2, 60.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(3.5, 5, 0.1), new THREE.Vector3(-0.02, 0, 0.), false, "./wood.png"), // east wall
  new wall(new THREE.Vector3(-87.5, 8.2, 60.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(3.4, 5, 0.1), new THREE.Vector3(0.02, 0, 0), false, "./wood.png"),
  new wall(new THREE.Vector3(-87.7, 8.2, 55.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(2.5, 5, 0.1), new THREE.Vector3(-0.02, 0, 0.), false, "./wood.png"),
  new wall(new THREE.Vector3(-87.5, 8.2, 55.25), new THREE.Vector3(0, Math.PI / 2, 0), new THREE.Vector3(2.4, 5, 0.1), new THREE.Vector3(0.02, 0, 0), false, "./wood.png"),
  new wall(new THREE.Vector3(-112.4, 8.2, 58.525), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 5, 0.1), new THREE.Vector3(0, 0, -0.02), false, "./wood.png"), // seal off the wall loops
  new wall(new THREE.Vector3(-112.4, 8.2, 56.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 5, 0.1), new THREE.Vector3(0, 0, 0.02), false, "./wood.png"),
  new wall(new THREE.Vector3(-100, 5.4, 58), new THREE.Vector3(0, 0, 0), new THREE.Vector3(25, 1, 8), new THREE.Vector3(0, 0.01, 0), true, "./wood.png"), // floor
], [
  new THREEDModel(new THREE.Vector3(-90, 5.9, 58), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0.5, 0.5), 0.5, 15, "./lever.glb")
]);

const resSpotStart = new respawnPoint(starting_island_Greymarsh.models[0], 2, "press E to save", [starting_island_Greymarsh], new THREE.Vector3(0, 0, 0));
respawnStandard = resSpotStart;
const resSpotImmortal_Keep = new respawnPoint(boss_Immortal_Keep.models[0], 2, "press E to save", [starting_island_Greymarsh], new THREE.Vector3(77, -2, 61.5));
const resSpotBirmingham = new respawnPoint(Fallen_Capitalentrance.models[0], 2, "press E to save", [starting_island_Greymarsh], new THREE.Vector3(-61, 2.4, 99));

const cirenLever = new lever(mcdonalds_Greymarsh.models[2], 2, "");
const birminghamLever = new lever(mcdonaldsFallen_Capital.models[0], 2, "");

const enemyMoai = new THREEDModel(new THREE.Vector3(-50, -1, 28), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.1, 1.1, 1.1), 0.25, 1, "./undead fisherman.glb");
const enemyMoaiHarpoon = new THREEDModel(new THREE.Vector3(0, 100, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./harpoon.glb", true);
const enemyMoai2 = new THREEDModel(new THREE.Vector3(-10, -0.5, 32), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.1, 1.1, 1.1), 0.25, 1, "./undead fisherman.glb");
const enemyMoaiHarpoon2 = new THREEDModel(new THREE.Vector3(0, 100, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./harpoon.glb", true);
const enemyMoai3 = new THREEDModel(new THREE.Vector3(-53.5, -1, 27), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.1, 1.1, 1.1), 0.25, 1, "./undead fisherman.glb");
const enemyMoaiHarpoon3 = new THREEDModel(new THREE.Vector3(0, 100, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./harpoon.glb", true);
const enemyMoai4 = new THREEDModel(new THREE.Vector3(-20, 1, 90), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.1, 1.1, 1.1), 0.25, 1, "./undead fisherman.glb");
const enemyMoaiHarpoon4 = new THREEDModel(new THREE.Vector3(0, 100, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./harpoon.glb", true);
const enemyMoai5 = new THREEDModel(new THREE.Vector3(-27, 0.5, 87), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.1, 1.1, 1.1), 0.25, 1, "./undead fisherman.glb");
const enemyMoaiHarpoon5 = new THREEDModel(new THREE.Vector3(0, 100, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./harpoon.glb", true);
const harpoon_stab = new attack(0.75, 0.5, Math.PI / 2, 0.45, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], 35, 1.5, "stab", enemyMoaiHarpoon, true);
const harpoon_stab2 = new attack(0.75, 0.5, Math.PI / 2, 0.45, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], 35, 1.5, "stab", enemyMoaiHarpoon2, true);
const harpoon_stab3 = new attack(0.75, 0.5, Math.PI / 2, 0.45, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], 35, 1.5, "stab", enemyMoaiHarpoon3, true);
const harpoon_stab4 = new attack(0.75, 0.5, Math.PI / 2, 0.45, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], 35, 1.5, "stab", enemyMoaiHarpoon4, true);
const harpoon_stab5 = new attack(0.75, 0.5, Math.PI / 2, 0.45, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], 35, 1.5, "stab", enemyMoaiHarpoon5, true);
const enemy = new Combatant(enemyMoai, 50, 0.05, 20, [harpoon_stab], "arthur richards", meleeSimple, new THREE.Vector3(-50, -1, 28), 0.5);
const enemy2 = new Combatant(enemyMoai2, 50, 0.05, 20, [harpoon_stab2], "bruh", meleeSimple, new THREE.Vector3(-53.5, -1, 27), 0.5);
const enemy3 = new Combatant(enemyMoai3, 50, 0.05, 20, [harpoon_stab3], "stevse", meleeSimple, new THREE.Vector3(-25, -1, 90), 0.5);
const enemy4 = new Combatant(enemyMoai4, 50, 0.05, 20, [harpoon_stab4], "brsuh", meleeSimple, new THREE.Vector3(-27, -0.5, 87), 0.5);
const enemy5 = new Combatant(enemyMoai5, 50, 0.05, 20, [harpoon_stab5], "stseve", meleeSimple, new THREE.Vector3(-10, -0.5, 32), 0.5);
enemyMoai.load();
enemyMoaiHarpoon.load();
enemyMoai2.load();
enemyMoaiHarpoon2.load();
enemyMoai3.load();
enemyMoaiHarpoon3.load();
enemyMoai4.load();
enemyMoaiHarpoon4.load();
enemyMoai5.load();
enemyMoaiHarpoon5.load();
const giant = new THREEDModel(new THREE.Vector3(10, -50, 57.5), new THREE.Vector3(0, 0, 0), new THREE.Vector3(2.1, 2.1, 2.1), 0.5, 2, "./undead fisherman.glb");
const giantCleaver = new THREEDModel(new THREE.Vector3(0, 100.25, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./giant cleaver.glb", true);
const giantSwingLeft = new attack(0.7, 0.3, Math.PI / 2, 0.45, [0.75, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], 60, 2, "sweep", giantCleaver, true);
const giantDefender = new Combatant(giant, 150, 0.06, 35, [giantSwingLeft], "theGiant", meleeGiant, new THREE.Vector3(10, -50, 57.5), 0.5)
giant.load();
giantCleaver.load();
const knight = new THREEDModel(new THREE.Vector3(-77, 5, 105), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.6, 1.6, 1.6), 0.3, 1.4, "./fallen templar.glb");
const knightSword = new THREEDModel(new THREE.Vector3(0, 100.25, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./templar sword.glb", true);
const knightStrike = new attack(0.7, 0.3, Math.PI / 2, 0.45, [0.75, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], 60, 2, "stab", knightSword, false);
const knightSpin = new attack(1.1, 0.4, Math.PI * (9/4), 0.45, [1.5, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], 30, 2, "sweep", knightSword, true, knightStrike);
const knightBoss = new Combatant(knight, 150, 0.06, 35, [knightStrike, knightSpin], "Guardian Templar", fallenTemplar, new THREE.Vector3(-77, 5, 105), 0.5)
knight.load();
knightSword.load();
const birmFisherman1 = new THREEDModel(new THREE.Vector3(-100, 6.4, 88), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.1, 1.1, 1.1), 0.25, 1, "./undead fisherman.glb");
const bf1Harpoon = new THREEDModel(new THREE.Vector3(0, 100, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./harpoon.glb", true);
const harpoon_stabb1 = new attack(0.75, 0.5, Math.PI / 2, 0.45, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], 35, 1.5, "stab", bf1Harpoon, true);
const birmfish1 = new Combatant(birmFisherman1, 50, 0.05, 20, [harpoon_stabb1], "danny g", meleeSimple, new THREE.Vector3(-100, 6.4, 88), 0.5);
birmFisherman1.load();
bf1Harpoon.load();
const birmFisherman2 = new THREEDModel(new THREE.Vector3(-105, 6.4, 83), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.1, 1.1, 1.1), 0.25, 1, "./undead fisherman.glb");
const bf2Harpoon = new THREEDModel(new THREE.Vector3(0, 100, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./harpoon.glb", true);
const harpoon_stabb2 = new attack(0.75, 0.5, Math.PI / 2, 0.45, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], 35, 1.5, "stab", bf2Harpoon, true);
const birmfish2 = new Combatant(birmFisherman2, 50, 0.05, 20, [harpoon_stabb2], "danny g2", meleeSimple, new THREE.Vector3(-105, 6.4, 83), 0.5);
birmFisherman2.load();
bf2Harpoon.load();
const knight2 = new THREEDModel(new THREE.Vector3(-103, 6.4, 80), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.6, 1.6, 1.6), 0.3, 1.4, "./fallen templar.glb");
const knightSword2 = new THREEDModel(new THREE.Vector3(0, 100.25, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./templar sword.glb", true);
const knightStrike2 = new attack(0.7, 0.3, Math.PI / 2, 0.45, [0.75, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], 60, 2, "stab", knightSword2, false);
const knightSpin2 = new attack(1.1, 0.4, Math.PI * (9/4), 0.45, [1.5, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], 30, 2, "sweep", knightSword2, true, knightStrike2);
const knightBoss2 = new Combatant(knight2, 150, 0.06, 35, [knightStrike2, knightSpin2], "Fallen Templar", fallenTemplar, new THREE.Vector3(-103, 6.4, 80), 0.5)
knight2.load();
knightSword2.load();
const fallenKing = new THREEDModel(new THREE.Vector3(77, 2, -24), new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2), 0.3, 1.6, "./last king.glb");
const FallenKingsGreatsword = new THREEDModel(new THREE.Vector3(0, 100.25, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./templar sword vertical.glb", true);
const FallenKingsGreatsword2 = new THREEDModel(new THREE.Vector3(0, 100.25, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 0.35, 0.35), 0, 0, "./templar sword.glb", true);
const GroundStab = new attack(0.5, 0.3, Math.PI / 2, 0.45, [0.75, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], 60, 2, "gstab", FallenKingsGreatsword2, true);
const halfMoonSweep = new attack(1.3, 0.4, Math.PI * (3/4), 0.45, [1.5, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], 20, 1, "sweep", FallenKingsGreatsword, false);
const ReachStab = new attack(1, 0.4, 1, 0.45, [1.5, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5], 35, 2, "stab", FallenKingsGreatsword, true, halfMoonSweep);
const TheLastKing = new Combatant(fallenKing, 500, 0.08, 35, [GroundStab, halfMoonSweep, ReachStab], "Ulrulich, the Last King", LastKingAI, new THREE.Vector3(77, 2, -24), 0.5);
fallenKing.load();
FallenKingsGreatsword.load();
FallenKingsGreatsword2.load();

starting_island_Greymarsh.load();
mcdonalds_Greymarsh.load();
second_island_Greymarsh.load();
random_island_Greymarsh.load();
entrance_hall_Immortal_Keep.load();
boss_Immortal_Keep.load();
Fallen_Capitalentrance.load();
Fallen_Capitalmain.load();
mcdonaldsFallen_Capital.load();

function render(){
  modelCheck();
    playerModel.mesh.getWorldDirection(PlayerFacing);
    PlayerFacing.normalize();
    PlayerRight = MATHS.calcVectorPerpendicular(PlayerFacing);

    INPUTSYS.updateControls();
    if (!animationLock){
      playerState = "neutral";
    }
    if (INPUTSYS.getKey("enter")){
      OpenGate("boss");
    }
    
    if (gravity > 0){
      playerState = "jump";
      playerModel.mesh.position.y += gravity * 0.45;
    } else{
      if (airTime > 0.1){
        playerState = "fall";
      }
      playerModel.mesh.position.y += gravity;
    }
    if (gravity > -0.2){
      gravity = Math.cos(Math.min(airTime * 4, 3.1416)) * 0.6;
    }

    if (roll > 0){
      if (roll > 2.5){
        playerModel.mesh.position.z += PlayerFacing.z * rollSpeed;
        playerModel.mesh.position.x += PlayerFacing.x * rollSpeed;
      } else{
        animationLock = false;
        playerModel.mesh.scale.set(1, 2, 1);
      }
      roll -= 0.1;
    }
    if (playerCombatant.hp > 0){
    if (INPUTSYS.getKey("w") && !animationLock && playerCombatant.hurtTimer <= 0){
        playerModel.mesh.position.z += PlayerFacing.z * (moveSpeed + run);
        playerModel.mesh.position.x += PlayerFacing.x * (moveSpeed + run);
        if (run > 0){
          playerState = "run";
        } else{
          playerState = "walk";
        }
    }
    if (INPUTSYS.getKey("s") && !animationLock && playerCombatant.hurtTimer <= 0){
        playerModel.mesh.position.z -= PlayerFacing.z * (moveSpeed + run);
        playerModel.mesh.position.x -= PlayerFacing.x * (moveSpeed + run);
        if (run > 0){
          playerState = "run";
        } else{
          playerState = "walk";
        }
    }
    if (INPUTSYS.getKey("a") && !animationLock && playerCombatant.hurtTimer <= 0){
        playerModel.mesh.position.z += PlayerRight.z * (moveSpeed + run);
        playerModel.mesh.position.x += PlayerRight.x * (moveSpeed + run);
        if (run > 0){
          playerState = "run";
        } else{
          playerState = "walk";
        }
    }
    if (INPUTSYS.getKey("d") && !animationLock && playerCombatant.hurtTimer <= 0){
        playerModel.mesh.position.z -= PlayerRight.z * (moveSpeed + run);
        playerModel.mesh.position.x -= PlayerRight.x * (moveSpeed + run);
        if (run > 0){
          playerState = "run";
        } else{
          playerState = "walk";
        }
    }
    if (INPUTSYS.getKey("space") && grounded && !animationLock && playerCombatant.hurtTimer <= 0){
      gravity = 0.1;
    }
    if(INPUTSYS.getLeftShift() > 0 && INPUTSYS.getLeftShift() < 0.45 && roll <= 0 && !animationLock && playerCombatant.hurtTimer <= 0){
      playerModel.mesh.scale.set(1, 1, 1);
      playerModel.mesh.position.y -= 0.5;
      roll = 5;
      run = 0;
      playerState = "roll";
      animationLock = true;
    } else if (INPUTSYS.getLeftShift() == -1){
      run = 0.025;
    } else {
      INPUTSYS.clearLSTimer();
      run = 0;
    }
    if (INPUTSYS.getKey("e") && !animationLock && playerCombatant.hurtTimer <= 0){
      respawnPoints.forEach(element => {
        element.save();
      });
      Levers.forEach(element => {
        console.log("checking lever");
        element.pull();
      })
    }
    }

    grounded = false;

    playerBoundingBox.setFromObject(playerModel.mesh);
    collidableWalls.forEach(colidable => {
      if (playerBoundingBox.intersectsBox(colidable.boundingBox)){
        if (colidable.isFloor){
          grounded = true;
        }
        if (colidable.isTrigger != null ){
          if (!colidable.activated)
          {
            if (colidable.isTrigger == "inv"){
              while(playerBoundingBox.intersectsBox(colidable.boundingBox)){
                playerModel.mesh.position.x += colidable.ejectionDirection.x;
                playerModel.mesh.position.y += colidable.ejectionDirection.y;
                playerModel.mesh.position.z += colidable.ejectionDirection.z;
                playerBoundingBox.setFromObject(playerModel.mesh);
              }
            } else if (colidable.isTrigger == "bossBar")
            {
              bosshealthBar.style.top = "90%";
              bosshealthBarBG.style.top = "90%";
              bossName.style.top = "80%";
            } else{
              TitleTextManager.setTitle(colidable.isTrigger, 4);
              colidable.activated = true;
            }
          }
        } else{
          while(playerBoundingBox.intersectsBox(colidable.boundingBox)){
            playerModel.mesh.position.x += colidable.ejectionDirection.x;
            playerModel.mesh.position.y += colidable.ejectionDirection.y;
            playerModel.mesh.position.z += colidable.ejectionDirection.z;
            playerBoundingBox.setFromObject(playerModel.mesh);
          }
        }
      }
    });

    collidableModels.forEach(colidable => {
      if (MATHS.distance2D(new THREE.Vector2(playerModel.mesh.position.x, playerModel.mesh.position.z), new THREE.Vector2(colidable._pos.x, colidable._pos.z)) < colidable.hitbox.radius + 0.5 
      && (colidable.hitbox.height / 2) + 0.5 > Math.abs(colidable._pos.y - playerModel.mesh.position.y) && colidable.modelPathway != "./scene.gltf"){
        let tries = 0;
        let ejecDirec = new THREE.Vector3(
          playerModel.mesh.position.x - colidable._pos.x,
          0,
          playerModel.mesh.position.z - colidable._pos.z
        );
        ejecDirec.normalize();
        ejecDirec.x *= 0.02;
        ejecDirec.z *= 0.02;
        while (MATHS.distance2D(new THREE.Vector2(playerModel.mesh.position.x, playerModel.mesh.position.z), new THREE.Vector2(colidable._pos.x, colidable._pos.z)) < colidable.hitbox.radius + 0.5){
          tries++;
          if (tries == 10){
            break;
          }
          playerModel.mesh.position.x += ejecDirec.x;
          playerModel.mesh.position.z += ejecDirec.z;
          playerBoundingBox.setFromObject(playerModel.mesh);
        }
      }
    });

    if (grounded){
      airTime = 0;
      grounded = -0.2;
    } else{
      airTime += FRAMETIME;
    }

    if ((playerState == "roll" || !animationLock) && playerWeapon){ // sets weapon to default at the player's side
      playerWeapon.position.set(playerModel.mesh.position.x - (0.45 * PlayerRight.x), playerModel.mesh.position.y - 0.1, playerModel.mesh.position.z - (PlayerRight.z * 0.45));
      playerWeapon.rotation.set(playerModel.mesh.rotation.x, playerModel.mesh.rotation.y, playerModel.mesh.rotation.z);
    }

    if (playerState == "light attack"){
      if (animationProgression > playerCombatant.attacks[0].windUp){
        playerCombatant.attacks[0].attack(playerModel.mesh.position, playerModel.mesh.rotation.y, animationProgression, new THREE.Vector3(0, 0, 0), "player");
        if (animationProgression > playerCombatant.attacks[0].duration + playerCombatant.attacks[0].windUp){
          animationLock = false;
          animationProgression = 0;
        }
      } else{
        playerCombatant.attacks[0].prepareWeapon(animationProgression / playerCombatant.attacks[0].windUp, PlayerRight, playerModel.mesh.position, playerModel.mesh.rotation);
      }
      animationProgression += FRAMETIME;
    } else if (playerState == "heavy attack"){
      if (animationProgression > playerCombatant.attacks[1].windUp){
        playerCombatant.attacks[1].attack(playerModel.mesh.position, playerModel.mesh.rotation.y, animationProgression, new THREE.Vector3(PlayerRight.x * -0.15, 0, PlayerRight.z * -0.15), "player");
        if (animationProgression > playerCombatant.attacks[1].duration + playerCombatant.attacks[1].windUp){
          animationLock = false;
          animationProgression = 0;
        }
      } else{
        playerCombatant.attacks[1].prepareWeapon(animationProgression / playerCombatant.attacks[1].windUp, PlayerRight.multiplyScalar(0.5), playerModel.mesh.position, playerModel.mesh.rotation);
      }
      animationProgression += FRAMETIME;
    }

    if (modelPlayer._model){
      modelPlayer._model.position.set(playerModel.mesh.position.x, playerModel.mesh.position.y, playerModel.mesh.position.z);
      modelPlayer._model.rotation.y = playerModel.mesh.rotation.y;
      modelPlayer._pos.set(playerModel.mesh.position.x, playerModel.mesh.position.y, playerModel.mesh.position.z);
    } else{
      console.log("not loaded yet");
    }

    playerCombatant.hurtTimer -= FRAMETIME;
    // AI stuff
    combatants.forEach(combatant => {
      if (combatant.name != "player"){ // the player isn't an AI (probably) so don't control them
        //console.log("updating " + combatant.name);
        combatant.AI.onUpdate(combatant);
        combatant.canSpotPlayer(combatant.model._pos, playerModel.mesh.position);
        if (combatant.alerted){
          combatant.AI.whileAlerted(combatant);
        }
        const toGround = new Ray(combatant.model._pos, new THREE.Vector3(0, -1, 0));
        let highestpos = -999;
        collidableWalls.forEach(wall =>{
          if (wall.isFloor && toGround.intersectsBox(wall.boundingBox) && wall.cube.mesh.position.y > highestpos){
            combatant.model._pos.y = wall.cube.mesh.position.y + combatant.model.hitbox.height + (wall.cube.mesh.scale.y / 2);
            highestpos = wall.cube.mesh.position.y;
          }
        })
      }
    })

    camera.position.x = playerModel.mesh.position.x - PlayerFacing.x * 5;
    camera.position.y = playerModel.mesh.position.y + camHeight;
    camera.position.z = playerModel.mesh.position.z - PlayerFacing.z * 5;
    camera.lookAt(new THREE.Vector3(playerModel.mesh.position.x, playerModel.mesh.position.y + 1, playerModel.mesh.position.z));

    TitleTextManager.update();

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}
document.addEventListener('click', e => {
  e.preventDefault();
  if ((playerState == "neutral" || playerState == "walk") && !animationLock && playerCombatant.hurtTimer <= 0){
    console.log("click");
    playerState = "light attack";
    animationLock = true;
    playerCombatant.attacks[0].hasHit.forEach(item => {
      playerCombatant.attacks[0].hasHit.pop(item);
    })
  }
});
window.addEventListener("contextmenu", e => {
  e.preventDefault();
  if ((playerState == "neutral" || playerState == "walk") && playerCombatant && playerCombatant.hurtTimer <= 0){
    console.log("r click");
    playerState = "heavy attack";
    animationLock = true;
    playerCombatant.attacks[1].hasHit.forEach(item => {
      playerCombatant.attacks[1].hasHit.pop(item);
    })
  }
})
document.addEventListener("mousemove", e => {
  e.preventDefault();
  if (!animationLock && playerCombatant.hurtTimer <= 0){
    playerModel.mesh.rotation.y += e.movementX * -0.006;
    camHeight += e.movementY * 0.01;
    camHeight = Math.max(camHeight, -0.75);
    camHeight = Math.min(camHeight, 3);
  }
})
render();

function modelCheck(){ //some models take a bit of time to load, this handles the important ones
  if (playerWeapon){
    bad_goofer_light.reloadModel(playerWeapon);
    playerCombatant.attacks[1].reloadModel(playerWeapon);
  }
  if (entrance_hall_Immortal_Keep.models[0]){
    entrance_hall_Immortal_Keep.models[0].set_Model(entrance_hall_Immortal_Keep.models[0]._model)
  }
  if (Fallen_Capitalentrance.models[1]){
    Fallen_Capitalentrance.models[1].set_Model(Fallen_Capitalentrance.models[1]._model)
  }
  let indexNo = 0;
  weaponsforReload.forEach(_attack => {
    indexNo = MATHS.arrayPosition(weaponsforReload, _attack);
    if (weaponModelsForReload[indexNo]){
      _attack.reloadModel(weaponModelsForReload[indexNo]._model);
    }
  });
}

function bounceBackGLTFScene(scene, recipient){
  collidableModels[recipient].set_Model(scene);
}

function respawnPlayer(){
  combatants.forEach(_combatant => {
    _combatant.model._pos.set(_combatant.spawnPos.x, _combatant.spawnPos.y, _combatant.spawnPos.z);
    _combatant.model._model.position.set(_combatant.spawnPos.x, _combatant.spawnPos.y, _combatant.spawnPos.z);
    _combatant.hp = _combatant.maxHP;
    _combatant.state = "neutral";
  })
  desceased.forEach(_combatant => {
    _combatant.revive();
  });
  desceased.shift(desceased.length);
  playerModel.mesh.position.set(respawnStandard.respawnPoint.x, respawnStandard.respawnPoint.y, respawnStandard.respawnPoint.z);
  animationLock = false;
  healthBar.style.width = (playerCombatant.hp * 5).toString() + "px";
  healthBar.style.left = ((playerCombatant.hp * 5) + 25).toString() + "px";
  bosshealthBar.style.top = "190%";
  bosshealthBar.style.width = "80%";
  bosshealthBar.style.left = "80%";
  bosshealthBarBG.style.top = "190%";
  bossName.style.top = "190%";
}

function OpenGate(gate){
  if (gate == "birm"){
    Fallen_Capitalentrance.objects[13].cube.mesh.position.y = -500;
    Fallen_Capitalentrance.objects[13].boundingBox.setFromObject(Fallen_Capitalentrance.objects[13].cube.mesh);
    Fallen_Capitalentrance.models[1]._pos.y = -500;
    Fallen_Capitalentrance.models[1]._model.position.y = -500;
  } else if (gate == "boss"){
    entrance_hall_Immortal_Keep.objects[0].cube.mesh.position.y = -500;
    entrance_hall_Immortal_Keep.objects[0].boundingBox.setFromObject(entrance_hall_Immortal_Keep.objects[0].cube.mesh);
    entrance_hall_Immortal_Keep.models[0]._pos.y = -500;
    entrance_hall_Immortal_Keep.models[0]._model.position.y = -500;
    giantDefender.model._pos.y = 0;
    giantDefender.model._model.position.y = 0;
    giantDefender.spawnPos.y = 0;
  }
}