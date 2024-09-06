import React, { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';

interface RadioPlayerProps {
  streamUrl: string;
}

const RadioPlayer: React.FC<RadioPlayerProps> = ({ streamUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSound, setCurrentSound] = useState<Howl | null>(null);
  const [nextSound, setNextSound] = useState<Howl | null>(null);
  const currentClipIndexRef = useRef<number | null>(null);

  const createSound = (url: string): Promise<Howl> => {
    return new Promise((resolve) => {
      const sound = new Howl({
        src: [url],
        html5: true,
        format: ['wav'],
        onload: () => resolve(sound),
      });
    });
  };

  const fetchAndPlayClip = async () => {
    const response = await fetch(streamUrl);
    const clipIndex = parseInt(response.headers.get('X-Clip-Index') || '-1', 10);
    
    if (clipIndex === currentClipIndexRef.current) {
      // If we got the same clip, try again
      fetchAndPlayClip();
      return;
    }

    currentClipIndexRef.current = clipIndex;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const sound = await createSound(url);

    if (currentSound) {
      currentSound.fade(1, 0, 1000);
      sound.fade(0, 1, 1000);
      setTimeout(() => {
        currentSound.unload();
        setCurrentSound(sound);
      }, 1000);
    } else {
      setCurrentSound(sound);
    }

    sound.play();
    sound.on('end', fetchAndPlayClip);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      currentSound?.pause();
    } else {
      if (currentSound) {
        currentSound.play();
      } else {
        fetchAndPlayClip();
      }
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    return () => {
      currentSound?.unload();
      nextSound?.unload();
    };
  }, []);

  return (
    <div className="radio-player">
      <button onClick={togglePlayPause}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
    </div>
  );
};

export default RadioPlayer;