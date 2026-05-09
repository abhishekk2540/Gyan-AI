import { useEffect, useRef } from 'react';
import anime from 'animejs';

export default function AnimatedTitle({ title, accentWord }) {
  const titleRef = useRef(null);

  useEffect(() => {
    // Basic cleanup and setup
    const words = titleRef.current.querySelectorAll('.word');
    
    // Animation logic: Sleek Slide from Right + Scale
    anime.timeline({ 
      loop: false,
      begin: () => {
        window.dispatchEvent(new CustomEvent('titleAnimationStart'));
      },
      complete: () => {
        window.dispatchEvent(new CustomEvent('titleAnimationEnd'));
      }
    })
      .add({
        targets: words,
        translateX: [40, 0],
        translateZ: 0,
        opacity: [0, 1],
        scale: [0.5, 1],
        easing: "easeOutExpo",
        duration: 1200,
        delay: (el, i) => 100 * i
      });
  }, [title]);

  const words = title.split(' ');

  return (
    <h1 className="ml15" ref={titleRef}>
      {words.map((word, i) => (
        <span 
          key={i} 
          className={`word ${word === accentWord ? 'accent' : ''}`}
        >
          {word}
        </span>
      ))}
    </h1>
  );
}
