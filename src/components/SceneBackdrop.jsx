import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const SceneBackdrop = () => {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return undefined
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    const pointer = new THREE.Vector2(0, 0)
    const startedAt = performance.now()

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    camera.position.set(0, 0.8, 8)

    const group = new THREE.Group()
    scene.add(group)

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xf7b955,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.42,
      metalness: 0.48,
      roughness: 0.28,
    })
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: 0x2e214f,
      metalness: 0.8,
      roughness: 0.32,
    })
    const blueMaterial = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x581c87,
      emissiveIntensity: 0.3,
      metalness: 0.38,
      roughness: 0.26,
    })

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.34, 2), coreMaterial)
    const torus = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.045, 14, 120), blueMaterial)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.035, 12, 120), darkMaterial)

    torus.rotation.x = Math.PI / 2.7
    ring.rotation.x = Math.PI / 2.1
    ring.rotation.y = Math.PI / 7
    group.add(core, torus, ring)

    const satelliteGeometry = new THREE.SphereGeometry(0.12, 22, 22)
    const satellites = Array.from({ length: 18 }, (_item, index) => {
      const material = index % 3 === 0 ? coreMaterial : index % 3 === 1 ? blueMaterial : darkMaterial
      const satellite = new THREE.Mesh(satelliteGeometry, material)
      const orbit = 1.9 + (index % 6) * 0.3
      const angle = (index / 18) * Math.PI * 2

      satellite.userData = {
        angle,
        orbit,
        speed: 0.18 + (index % 5) * 0.035,
        tilt: (index % 4) * 0.42,
      }
      group.add(satellite)

      return satellite
    })

    const particlesGeometry = new THREE.BufferGeometry()
    const particleCount = 140
    const positions = new Float32Array(particleCount * 3)

    for (let index = 0; index < particleCount; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 12
      positions[index * 3 + 1] = (Math.random() - 0.5) * 7
      positions[index * 3 + 2] = (Math.random() - 0.5) * 7
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({
        color: 0xfacc15,
        opacity: 0.5,
        size: 0.036,
        transparent: true,
      }),
    )
    scene.add(particles)

    scene.add(new THREE.AmbientLight(0xffffff, 0.64))

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15)
    keyLight.position.set(3.8, 4.8, 4)
    scene.add(keyLight)

    const tealLight = new THREE.PointLight(0xf7b955, 5, 15)
    tealLight.position.set(-3.5, 2.2, 3.5)
    scene.add(tealLight)

    const blueLight = new THREE.PointLight(0xa855f7, 4, 13)
    blueLight.position.set(3.3, -2.2, 4.4)
    scene.add(blueLight)

    const resize = () => {
      const width = mount.clientWidth || window.innerWidth
      const height = mount.clientHeight || window.innerHeight

      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const updatePointer = (event) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2
    }

    let animationFrame = 0

    const animate = () => {
      const elapsed = (performance.now() - startedAt) / 1000

      group.rotation.y = elapsed * 0.15 + pointer.x * 0.18
      group.rotation.x = Math.sin(elapsed * 0.42) * 0.1 + pointer.y * 0.08
      core.rotation.y = elapsed * 0.34
      core.rotation.x = elapsed * 0.22
      torus.rotation.z = elapsed * 0.24
      ring.rotation.z = -elapsed * 0.18
      particles.rotation.y = elapsed * 0.025

      satellites.forEach((satellite) => {
        const angle = satellite.userData.angle + elapsed * satellite.userData.speed
        const orbit = satellite.userData.orbit
        const tilt = satellite.userData.tilt

        satellite.position.set(
          Math.cos(angle) * orbit,
          Math.sin(angle + tilt) * 0.62,
          Math.sin(angle) * orbit,
        )
      })

      camera.position.x += (pointer.x * 0.45 - camera.position.x) * 0.035
      camera.position.y += (-pointer.y * 0.32 + 0.8 - camera.position.y) * 0.035
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(animate)
    }

    resize()
    animate()

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', updatePointer)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', updatePointer)
      mount.removeChild(renderer.domElement)

      core.geometry.dispose()
      torus.geometry.dispose()
      ring.geometry.dispose()
      satelliteGeometry.dispose()
      particlesGeometry.dispose()
      coreMaterial.dispose()
      darkMaterial.dispose()
      blueMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return <div className="scene-backdrop" ref={mountRef} aria-hidden="true" />
}

export default SceneBackdrop
