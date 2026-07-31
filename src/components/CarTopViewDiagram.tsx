import Image from "next/image";

export function CarTopViewDiagram() {
  return (
    <Image
      src="/Car-Diagram/car-diagram-top-view.png"
      alt="Vehicle top view diagram"
      width={730}
      height={1080}
      className="h-full w-full object-contain"
      unoptimized
    />
  );
}
