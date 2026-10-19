import * as THREE from 'three';
import { fromPlant, FLOW_NETWORKS } from './system-flow-data.js';

const SMOKE_COUNT = 22, PARTICLE_COUNT = 8;
// Palette 12 hood bounds, measured from indexed GLB vertices in plant axes.
// Mouth centers sit on the sloping outer lip, not on the AHU housing.
export const AIR_TERMINALS = [
  { id: 'fresh-left', step: 0, intake: true, port: fromPlant(25.326, -23.528, 12.472),
    direction: fromPlant(0, 1, 0), length: 4.2, width: 0.70, color: '#319ee9' },
  { id: 'fresh-right', step: 0, intake: true, port: fromPlant(32.677, -23.554, 12.476),
    direction: fromPlant(0, 1, 0), length: 4.2, width: 0.70, color: '#319ee9' },
  // The first hood discharges sideways; the second hood rises toward -v.
  { id: 'exhaust-left', step: 5, intake: false, port: FLOW_NETWORKS['extract-left'].seeds[0],
    direction: fromPlant(-1, 0, 0), length: 4.5, width: 0.80, color: '#f39435' },
  { id: 'exhaust-right', step: 5, intake: false, port: fromPlant(38.60, -23.76, 6.32),
    direction: fromPlant(0, -0.8, 0.6), length: 4.5, width: 0.80, color: '#f39435' },
];

function vaporTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const data = context.createImageData(128,128);
  const hash = (x,y) => {
    let n = Math.imul(x + 59, 374761393) ^ Math.imul(y + 83, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x,y) => {
    const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
    const u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u),
      THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);
  };
  for(let y=0;y<128;y++) for(let x=0;x<128;x++) {
    const px=(x+0.5)/64-1, py=(y+0.5)/64-1;
    const r=Math.hypot(px,py);
    const n=noise(x/23,y/23)*0.6+noise(x/9,y/9)*0.28+noise(x/4,y/4)*0.12;
    const envelope=Math.pow(Math.max(0,1-r),0.9);
    const alpha=Math.min(1,envelope*THREE.MathUtils.smoothstep(n,0.23,0.65)*1.9);
    const i=(y*128+x)*4;
    data.data[i]=data.data[i+1]=data.data[i+2]=255;
    data.data[i+3]=Math.round(255*alpha);
  }
  context.putImageData(data,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.generateMipmaps=true;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  return texture;
}

const common = `
  uniform float airTime;
  uniform float airFade;
  uniform float airLength;
  uniform float airWidth;
  uniform float airScale;
  uniform float airIntake;
  uniform vec3 airOrigin;
  uniform vec3 airDirection;
  uniform vec3 airSide;
  uniform vec3 airUp;
  uniform vec3 airColor;
`;

function createPoolGeometry() {
  const plane = new THREE.PlaneGeometry(1,1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.attributes.position = plane.attributes.position;
  geometry.attributes.uv = plane.attributes.uv;
  // Fixed deterministic samples are recycled entirely in the vertex shader.
  const samples = new Float32Array((SMOKE_COUNT+PARTICLE_COUNT)*4);
  for(let i=0;i<SMOKE_COUNT+PARTICLE_COUNT;i++) {
    const particle=i>=SMOKE_COUNT, index=particle?i-SMOKE_COUNT:i;
    samples[i*4]=(index+0.35)/(particle?PARTICLE_COUNT:SMOKE_COUNT);
    samples[i*4+1]=((i*0.61803398875+0.17)%1)*Math.PI*2;
    samples[i*4+2]=0.3+((i*0.754877666+0.31)%1)*0.7;
    samples[i*4+3]=particle?1:0;
  }
  geometry.setAttribute('airSample',new THREE.InstancedBufferAttribute(samples,4));
  geometry.instanceCount=SMOKE_COUNT+PARTICLE_COUNT;
  // Buffer attributes are owned by this geometry after transferring the plane.
  return geometry;
}

function createRibbonGeometry() {
  const geometry=new THREE.PlaneGeometry(1,1,1,24);
  return geometry;
}

export function createAirflowSmoke(building) {
  const texture=vaporTexture();
  const poolGeometry=createPoolGeometry();
  const ribbonGeometry=createRibbonGeometry();
  const scale=building.getWorldScale(new THREE.Vector3()).x;
  const group=new THREE.Group();
  group.name='airflowSmoke'; group.visible=false;
  const plumes=[];
  const bounds=Array.from({length:6},()=>new THREE.Box3());
  const identificationBounds=Array.from({length:6},()=>[]);
  for(const terminal of AIR_TERMINALS) {
    const direction=new THREE.Vector3(...terminal.direction).normalize();
    const port=new THREE.Vector3(...terminal.port);
    const origin=port.clone();
    if(terminal.intake) origin.addScaledVector(direction,-terminal.length);
    const side=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize();
    const up=new THREE.Vector3().crossVectors(side,direction).normalize();
    const uniforms={airTime:{value:0},airFade:{value:0},airLength:{value:terminal.length},
      airWidth:{value:terminal.width},airScale:{value:scale},airIntake:{value:terminal.intake?1:0},
      airOrigin:{value:origin},airDirection:{value:direction},airSide:{value:side},airUp:{value:up},
      airColor:{value:new THREE.Color(terminal.color)},airTexture:{value:texture}};
    const material=new THREE.ShaderMaterial({
      uniforms,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,
      vertexShader:common+`
        attribute vec4 airSample;
        varying vec2 vUv;
        varying float vOpacity;
        varying float vParticle;
        void main() {
          float particle=airSample.w;
          float age=fract(airSample.x+airTime*(0.19+particle*0.18));
          // Intake accelerates gently towards the mouth; discharge keeps momentum.
          float progress=mix(age,age*age*0.25+age*0.75,airIntake);
          float openness=mix(progress,1.0-progress,airIntake);
          float radius=airWidth*(0.18+1.25*openness)*mix(1.0,0.24,particle);
          float angle=airSample.y+sin(age*6.283+airSample.y)*0.18;
          float lateral=sin(angle+age*0.7)*radius*airSample.z;
          float vertical=cos(angle*1.7-age*0.45)*radius*airSample.z*0.48;
          vec3 center=airOrigin+airDirection*(progress*airLength)+airSide*lateral+airUp*vertical;
          vec4 viewCenter=modelViewMatrix*vec4(center,1.0);
          float size=airWidth*(0.9+openness*1.8)*(0.7+airSample.z*0.5);
          size=mix(size,0.085+airSample.z*0.035,particle);
          float rotation=airSample.y+age*0.45;
          mat2 turn=mat2(cos(rotation),-sin(rotation),sin(rotation),cos(rotation));
          viewCenter.xy+=turn*position.xy*size*airScale;
          gl_Position=projectionMatrix*viewCenter;
          vUv=uv;
          float life=smoothstep(0.0,0.10,age)*(1.0-smoothstep(0.72,1.0,age));
          float density=mix(0.28*(1.0-progress*0.55),0.22+progress*0.10,airIntake);
          vOpacity=life*mix(density,0.86,particle)*airFade;
          vParticle=particle;
        }`,
      fragmentShader:common+`
        uniform sampler2D airTexture;
        varying vec2 vUv;
        varying float vOpacity;
        varying float vParticle;
        void main() {
          float r=length(vUv-0.5)*2.0;
          float core=pow(max(0.0,1.0-r),2.5);
          float alpha=mix(texture2D(airTexture,vUv).a,core,vParticle)*vOpacity;
          if(alpha<0.002)discard;
          vec3 tint=mix(airColor,mix(airColor,vec3(1.0),0.68),vParticle);
          tint=mix(tint,vec3(0.80,0.94,1.0),core*0.12*(1.0-vParticle));
          gl_FragColor=vec4(tint,alpha);
          #include <colorspace_fragment>
        }`,
    });
    const mesh=new THREE.Mesh(poolGeometry,material);
    mesh.name=terminal.id+'-vapor'; mesh.frustumCulled=false; mesh.visible=false;
    mesh.renderOrder=2;
    const ribbonMaterial=new THREE.ShaderMaterial({
      uniforms,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,
      vertexShader:common+`
        varying vec2 vUv;
        void main(){
          float t=uv.y;
          vec4 center=modelViewMatrix*vec4(airOrigin+airDirection*t*airLength,1.0);
          vec2 tangent=(modelViewMatrix*vec4(airDirection,0.0)).xy;
          tangent/=max(length(tangent),0.001);
          vec2 side=vec2(-tangent.y,tangent.x);
          center.xy+=side*position.x*airWidth*0.17*airScale;
          gl_Position=projectionMatrix*center;
          vUv=uv;
        }`,
      fragmentShader:common+`
        varying vec2 vUv;
        void main(){
          float edge=pow(max(0.0,1.0-abs(vUv.x-0.5)*2.0),1.5);
          float ends=smoothstep(0.0,0.08,vUv.y)*(1.0-smoothstep(0.90,1.0,vUv.y));
          float pulse=0.5+0.5*cos(vUv.y*25.13-airTime*5.0);
          gl_FragColor=vec4(airColor,edge*ends*(0.09+0.11*pulse)*airFade);
          #include <colorspace_fragment>
        }`,
    });
    const ribbon=new THREE.Mesh(ribbonGeometry,ribbonMaterial);
    ribbon.name=terminal.id+'-ribbon';ribbon.frustumCulled=false;ribbon.visible=false;ribbon.renderOrder=1;
    group.add(ribbon,mesh);
    const endpoint=origin.clone().addScaledVector(direction,terminal.length);
    const extent=new THREE.Vector3(1,1,1).multiplyScalar(terminal.width*2.2);
    identificationBounds[terminal.step].push(new THREE.Box3().setFromPoints([
      origin.clone().sub(extent), origin.clone().add(extent),
      endpoint.clone().sub(extent), endpoint.clone().add(extent),
    ]));
    bounds[terminal.step].expandByPoint(origin.clone().sub(extent)).expandByPoint(origin.clone().add(extent));
    bounds[terminal.step].expandByPoint(endpoint.clone().sub(extent)).expandByPoint(endpoint.clone().add(extent));
    plumes.push({terminal,mesh,ribbon,material,ribbonMaterial,uniforms,target:0});
  }
  building.add(group);
  let enabled=false;
  return {
    bounds,
    identificationBounds,
    setStep(index, restart=false){
      for(const p of plumes){
        p.target=enabled&&p.terminal.step===index?1:0;
        if(restart){p.uniforms.airTime.value=0;p.uniforms.airFade.value=0;p.mesh.visible=p.ribbon.visible=false;}
      }
    },
    setVisible(value){enabled=value;group.visible=true;if(!value)for(const p of plumes)p.target=0;},
    update(dt,reducedMotion,paused){
      if(!group.visible)return;
      let any=false;
      for(const p of plumes){
        const fade=p.uniforms.airFade;
        if(!p.target&&fade.value===0)continue;
        // Pause freezes the entire plume, including its fade and ribbon.
        if(!paused){
          fade.value=THREE.MathUtils.lerp(fade.value,p.target,reducedMotion?1:1-Math.exp(-dt*9));
          if(Math.abs(fade.value-p.target)<0.005)fade.value=p.target;
          if(!reducedMotion)p.uniforms.airTime.value+=dt;
        }
        p.mesh.visible=p.ribbon.visible=fade.value>0;
        any ||= p.mesh.visible;
      }
      group.visible=any||enabled;
    },
    reset(){enabled=false;group.visible=false;for(const p of plumes){p.target=0;p.uniforms.airTime.value=0;p.uniforms.airFade.value=0;p.mesh.visible=p.ribbon.visible=false;}},
    get state(){return plumes.map(p=>({id:p.terminal.id,step:p.terminal.step,visible:group.visible&&p.mesh.visible,
      target:p.target,fade:p.uniforms.airFade.value,time:p.uniforms.airTime.value,smoke:SMOKE_COUNT,particles:PARTICLE_COUNT}));},
    dispose(){this.reset();group.removeFromParent();for(const p of plumes){p.material.dispose();p.ribbonMaterial.dispose();}poolGeometry.dispose();ribbonGeometry.dispose();texture.dispose();},
  };
}
