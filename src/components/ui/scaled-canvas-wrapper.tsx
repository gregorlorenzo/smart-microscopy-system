import { useEffect, useRef, useState } from 'react';

interface ScaledCanvasWrapperProps {
  baseWidth?: number;
  baseHeight?: number;
  children: React.ReactNode;
}

export default function ScaledCanvasWrapper({
  baseWidth = 800,
  baseHeight = 600,
  children,
}: ScaledCanvasWrapperProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      setScale(Math.min(1, el.clientWidth / baseWidth));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth]);

  return (
    <div
      ref={outerRef}
      className="w-full overflow-hidden"
      style={{ aspectRatio: `${baseWidth} / ${baseHeight}` }}
    >
      <div
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
