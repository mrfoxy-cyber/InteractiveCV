// Moonshine 0.1.5 reports (loadedBytes, totalBytes, filename), not a fraction.
export function downloadProgress(loadedBytes,totalBytes){
  const loaded=Number.isFinite(loadedBytes)?Math.max(0,loadedBytes):0;
  const percent=Number.isFinite(totalBytes)&&totalBytes>0?Math.round(Math.min(1,loaded/totalBytes)*100):null;
  return {percent,label:percent===null?`Downloading model: ${(loaded/1_000_000).toFixed(1)} MB received`:`Downloading model: ${percent}%`};
}
