import React, { useEffect, useState, useMemo } from 'react';
import  Nikku_Avatar  from '../assets/Nikku_Avaatr.webp';
import Harshk_Avatar from '../assets/Harshk-Avatar.webp';
import '../DesignedBy.css';

const DesignedBy: React.FC = () => {
  const [text, setText] = useState('');
  const [visibleImageIndex, setVisibleImageIndex] = useState(0);
  const words = useMemo(() => [
    'Made', 'Built', 'Created', 'Composed', 'Hacked', 'Brewed', 'Crafted', 'Forged', 'Designed', 'Developed', 'Produced'
  ], []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let wordIndex = 0;
    let iteration = 0;

    const scrambleText = () => {
      const fullText = words[wordIndex];
      let scrambled = '';
      for (let i = 0; i < fullText.length; i++) {
        if (i < iteration) {
          scrambled += fullText[i];
        } else {
          scrambled += characters[Math.floor(Math.random() * characters.length)];
        }
      }
      setText(scrambled);

      if (iteration < fullText.length) {
        iteration++;
        timeout = setTimeout(scrambleText, 100); // Faster speed for smoother effect
      } else {
        setTimeout(() => {
          iteration = 0; 
          wordIndex = (wordIndex + 1) % words.length; 
          scrambleText();
        }, 4000); // Hold completed word for 4 seconds to sync with slide-up animation
      }
    };

    scrambleText();

    return () => clearTimeout(timeout);
  }, [words]);

  useEffect(() => {
    const imageInterval = setInterval(() => {
      setVisibleImageIndex((prevIndex) => (prevIndex + 1) % 2);
    }, 2500); 

    return () => clearInterval(imageInterval);
  }, []);

  return (
    <div className="text-gray-600 flex items-center justify-end mt-5">
      {text} by
      <div className="ml-2">
        <div className={`h-16 w-16 ${visibleImageIndex === 0 ? 'animate-slide-up' : 'hidden'}`}>
          <img className="h-full w-full rounded-md object-cover object-center" src={Nikku_Avatar} alt="Nikku Avatar" />
        </div>
        <div className={`h-16 w-16 ${visibleImageIndex === 1 ? 'animate-slide-up' : 'hidden'}`}>
          <img className="h-full w-full rounded-md object-cover object-center" src={Harshk_Avatar} alt="Harshk Avatar" />
        </div>
      </div>
    </div>
  );
};

export default DesignedBy;
