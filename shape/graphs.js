// Simple radar chart renderer used by the shape game.
window.RadarChart = (function(){
	function drawRadar(canvas, labels, values, options={}){
		if(!canvas) return;
		const ctx = canvas.getContext('2d');
		const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h);
		const cx = w/2, cy = h/2; const radius = Math.min(w,h)/2 - 36;
		ctx.save(); ctx.translate(cx, cy);
		// background web
		const steps = options.steps || 4;
		ctx.strokeStyle = options.gridColor || 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
		for(let s=1;s<=steps;s++){
			ctx.beginPath();
			const r = radius * (s/steps);
			for(let i=0;i<labels.length;i++){
				const ang = (i / labels.length) * Math.PI*2 - Math.PI/2;
				const x = Math.cos(ang)*r, y = Math.sin(ang)*r;
				if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
			}
			ctx.closePath(); ctx.stroke();
		}
		// spokes and labels (compact)
		ctx.fillStyle = options.labelColor || '#ccc'; ctx.font = options.labelFont || '11px system-ui, Arial';
		for(let i=0;i<labels.length;i++){
			const ang = (i / labels.length) * Math.PI*2 - Math.PI/2;
			const x = Math.cos(ang)*radius, y = Math.sin(ang)*radius;
			ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(x,y); ctx.stroke();
			// place labels slightly closer to the chart and use smaller offset
			const lx = Math.cos(ang)*(radius+18), ly = Math.sin(ang)*(radius+18);
			ctx.textAlign = (lx>0)?'left':(lx<0)?'right':'center'; ctx.textBaseline = (ly>0)?'top':(ly<0)?'bottom':'middle';
			ctx.fillText(labels[i], lx, ly);
		}
		// data polygon
		ctx.beginPath();
		for(let i=0;i<labels.length;i++){
			const v = Math.max(0, Math.min(1, values[i] || 0));
			const ang = (i / labels.length) * Math.PI*2 - Math.PI/2;
			const x = Math.cos(ang)*radius*v, y = Math.sin(ang)*radius*v;
			if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
		}
		ctx.closePath(); ctx.fillStyle = options.fillColor || 'rgba(255,200,80,0.12)'; ctx.fill(); ctx.strokeStyle = options.lineColor || 'rgba(255,200,80,0.8)'; ctx.lineWidth=2; ctx.stroke();
		// highlight points
		for(let i=0;i<labels.length;i++){
			const v = Math.max(0, Math.min(1, values[i] || 0));
			const ang = (i / labels.length) * Math.PI*2 - Math.PI/2;
			const x = Math.cos(ang)*radius*v, y = Math.sin(ang)*radius*v;
			ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fillStyle = options.pointColor || '#ffd066'; ctx.fill();
		}
		ctx.restore();
	}
	return { drawRadar };
})();