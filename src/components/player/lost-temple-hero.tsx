import type { CSSProperties } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { Play } from 'lucide-react';
import { slots } from '@/lib/slots';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import machineArt from '@/assets/lost-temple-machine.png';

const rays = [12, 29, 48, 67, 84];
const dust = Array.from({ length: 18 }, (_, index) => ({
  x: (index * 37 + 7) % 96,
  delay: -((index * 1.37) % 12),
  duration: 9 + (index % 5) * 1.7,
  size: 1 + (index % 3),
}));
const embers = Array.from({ length: 9 }, (_, index) => ({
  x: (index * 53 + 11) % 94,
  delay: -((index * 2.1) % 14),
  duration: 12 + (index % 4) * 2,
  size: 2 + (index % 2),
}));

type ParticleStyle = CSSProperties & {
  '--particle-x': string;
  '--particle-delay': string;
  '--particle-duration': string;
  '--particle-size': string;
};

function particleStyle(particle: { x: number; delay: number; duration: number; size: number }): ParticleStyle {
  return {
    '--particle-x': `${particle.x}%`,
    '--particle-delay': `${particle.delay}s`,
    '--particle-duration': `${particle.duration}s`,
    '--particle-size': `${particle.size}px`,
  };
}

export function LostTempleHero() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { t } = useI18n();
  const game = slots[0];
  const openGame = () => void navigate({ to: '/game/$gameId', params: { gameId: game.id } });

  return (
    <section className="temple-hero" aria-labelledby="temple-hero-title">
      <div className="temple-environment" aria-hidden="true">
        <div className="temple-ambient-light" />
        <div className="temple-silhouettes">
          <span className="temple-column temple-column-left-outer" />
          <span className="temple-column temple-column-left-inner" />
          <span className="temple-column temple-column-right-inner" />
          <span className="temple-column temple-column-right-outer" />
          <span className="temple-steps" />
          <span className="temple-foliage temple-foliage-left" />
          <span className="temple-foliage temple-foliage-right" />
        </div>
        <div className="temple-god-rays">
          {rays.map((position, index) => (
            <span key={position} style={{ left: `${position}%`, animationDelay: `${index * -2.3}s` }} />
          ))}
        </div>
        <div className="temple-torch-light temple-torch-light-left" />
        <div className="temple-torch-light temple-torch-light-right" />
        <div className="temple-particles temple-dust">
          {dust.map((particle, index) => <span key={index} style={particleStyle(particle)} />)}
        </div>
        <div className="temple-particles temple-embers">
          {embers.map((particle, index) => <span key={index} style={particleStyle(particle)} />)}
        </div>
        <div className="temple-mist" />
      </div>

      <div className="temple-hero-content">
        <div className="temple-hero-heading">
          <p>SOCHI SLOTS</p>
          <h1 id="temple-hero-title">{game.name}</h1>
          <span>{t[game.category]}</span>
        </div>

        <div className="temple-machine-stage">
          <motion.div
            className="temple-machine-float"
            animate={reduceMotion ? { y: 0 } : { y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img className="temple-machine-aura" src={machineArt} alt="" aria-hidden="true" />
            <Button
              variant="ghost"
              className="temple-machine-button"
              onClick={openGame}
              aria-label={`${t.play} ${game.name}`}
            >
              <img src={machineArt} alt="" width={768} height={1024} draggable={false} fetchPriority="high" />
            </Button>
          </motion.div>
          <Button className="temple-hero-play" onClick={openGame}>
            <Play className="size-4" fill="currentColor" />
            {t.play}
          </Button>
        </div>
      </div>
    </section>
  );
}
