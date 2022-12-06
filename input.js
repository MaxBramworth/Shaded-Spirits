let wDown = false;
let aDown = false;
let sDown = false;
let dDown = false;
let leftShiftDown = false;
let leftShiftTimer = 0;
let eDown = false;
let spaceDown = false;
let enterDown = false;

window.addEventListener('keyup', (e) => {
    switch (e.keyCode){
      case 87: // w
        wDown = false;
        break;
      case 65: // a
        aDown = false;
        break;
      case 83: // s
        sDown = false;
        break;
      case 68: // d
        dDown = false;
        break;
      case 16: // q
        leftShiftDown = false;
        break;
      case 69: // e
        eDown = false;
        break;
      case 32: // space
        spaceDown = false;
        break;
      case 13: // enter
        enterDown = false;
        break;
    }
});
window.addEventListener('keydown', (e) => {
  switch (e.keyCode){
    case 87: // w
      wDown = true;
      break;
    case 65: // a
      aDown = true;
      break;
    case 83: // s
      sDown = true;
      break;
    case 68: // d
      dDown = true;
      break;
    case 16: // leftshift
      leftShiftDown = true;
      break;
    case 69: // e
      eDown = true;
      break;
    case 32: // space
      spaceDown = true;
      break;
    case 13: // enter
      enterDown = true;
      break;
  }
});

export function getKey(key){
    switch(key){
        case "w":
            return(wDown);
            break;
        case "a":
            return(aDown);
            break;
        case "s":
            return(sDown);
            break;
        case "d":
            return(dDown);
            break;
        case "space":
            return(spaceDown);
            break;
        case "e":
            return(eDown);
            break;
        case "enter":
          return(enterDown);
          break;
    }
}

export function getLeftShift(){
  if (leftShiftDown){
    return (-1);
  } else{
    if (leftShiftTimer > 0){
      return(leftShiftTimer);
    } else{
      return(0);
    }
  }
}

export function updateControls(){
  if (leftShiftDown){
    leftShiftTimer += 1/60;
  }
}

export function clearLSTimer(){
  leftShiftTimer = 0;
}