export function scrollbar(content:number,visible:number,track:number,offset:number) {
  const maximum=Math.max(0,content-visible);
  const size=Math.min(track,Math.max(20,Math.floor(track*Math.min(1,visible/content))));
  const travel=track-size;
  const position=maximum?Math.round(travel*Math.max(0,Math.min(maximum,offset))/maximum):0;
  return {maximum,size,travel,position};
}

export function scrollFromThumb(position:number,metrics:ReturnType<typeof scrollbar>) {
  return metrics.travel?Math.round(Math.max(0,Math.min(metrics.travel,position))*metrics.maximum/metrics.travel):0;
}
