import { Mesh, MeshStandardMaterial, SphereBufferGeometry, Vector3 } from 'three'

export const BALL_PLAYER_BOUNCE_DISTANCE = 0.35
export const BALL_BOUNCE_SPEED = 1
export const BALL_FLY_SPEED = 1
export const BALL_FLY_ARC_HEIGHT = 3 // easier way for demo
export const BALL_FLY_DURATION = 2 // easier way for demo
export const BALL_FALL_IMPULSE = Object.freeze(new Vector3(0, -5, 0))

export const ballMaterial = new MeshStandardMaterial({ color: '#ca4f38' })
export const ballGeometry = new SphereBufferGeometry(0.12, 16, 12)
export const ballMesh = new Mesh(ballGeometry, ballMaterial)

export const FORWARD = Object.freeze(new Vector3(0, 0, 1))
