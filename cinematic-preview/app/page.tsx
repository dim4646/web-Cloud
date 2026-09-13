"use client";

import { useEffect, useRef } from "react";

const packages = ["PORTFOLIO", "BASIC", "BUSINESS", "SUPPORT"];

export default function Home() {
  const film = useRef<HTMLElement>(null);

  useEffect(() => {
    const update = () => {
      if (!film.current) return;
      const rect = film.current.getBoundingClientRect();
      const range = film.current.offsetHeight - innerHeight;
      const progress = Math.max(0, Math.min(1, -rect.top / range));
      film.current.style.setProperty("--p", progress.toFixed(4));
      film.current.dataset.chapter = progress < .18 ? "01" : progress < .48 ? "02" : progress < .76 ? "03" : "04";
      const chapter = film.current.querySelector<HTMLElement>(".chapter b");
      if (chapter) chapter.textContent = film.current.dataset.chapter;
    };
    update();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => { removeEventListener("scroll", update); removeEventListener("resize", update); };
  }, []);

  return <main>
    <section className="film" ref={film}>
      <div className="cinema">
        <header><a className="logo" href="#top"><i>W</i><span>WEB CLOUD<br/>SOLUTIONS</span></a><span className="chapter">SCENE <b>01</b> / 04</span><a href="#packages">EXPLORE ↘</a></header>
        <div className="ambient"><i/><i/><i/></div>
        <div className="gridFloor"/>
        <div className="rings"><i/><i/><i/></div>

        <div className="sceneText sceneOne"><small>YOUR BUSINESS, AMPLIFIED.</small><h1>From idea<br/>to <em>impact.</em></h1><p>Scroll to build your digital presence.</p></div>
        <div className="sceneText sceneTwo"><small>THE SYSTEM</small><h2>Every layer.<br/><em>Purposefully built.</em></h2></div>
        <div className="sceneText sceneThree"><small>THE EXPERIENCE</small><h2>Fast. Clear.<br/><em>Impossible to ignore.</em></h2></div>
        <div className="sceneText sceneFour"><small>WEB CLOUD SOLUTIONS</small><h2>Your business.<br/><em>Beautifully online.</em></h2><a href="#packages">CHOOSE YOUR PLAN ↘</a></div>

        <div className="machine" aria-label="Website assembling through scroll">
          <div className="halo"/>
          <div className="slab slabBack"><span>SECURE CLOUD</span><i/><i/><i/></div>
          <div className="slab slabData"><div className="dataBars"><i/><i/><i/><i/><i/></div><b>PERFORMANCE</b><strong>99</strong></div>
          <div className="slab slabDesign"><span>DESIGN SYSTEM</span><div className="swatches"><i/><i/><i/></div><div className="type">Aa</div></div>
          <div className="slab slabMain">
            <div className="browserTop"><i/><i/><i/><span>yourbusiness.com.au</span></div>
            <div className="siteNav"><b>YOUR BRAND</b><span>WORK&nbsp;&nbsp;&nbsp; SERVICES&nbsp;&nbsp;&nbsp; CONTACT</span></div>
            <div className="siteHero"><small>DESIGNED TO GROW</small><strong>Make your<br/><em>mark.</em></strong><button>START A PROJECT ↗</button></div>
            <div className="siteStats"><span><b>01</b> STRATEGY</span><span><b>02</b> DESIGN</span><span><b>03</b> LAUNCH</span></div>
          </div>
          <div className="slab slabMobile"><div className="phoneBar"/><small>YOUR BRAND</small><strong>Stand<br/>out.</strong><button>EXPLORE</button></div>
          <div className="cursor">↗</div>
        </div>

        <div className="progress"><span>SCROLL</span><i><b/></i><strong>BUILDING THE EXPERIENCE</strong></div>
      </div>
    </section>

    <section className="packages" id="packages">
      <div className="packagesHead"><small>04 / SELECT YOUR STARTING POINT</small><h2>Four ways to move<br/><em>your business forward.</em></h2></div>
      <div className="packageList">{packages.map((name,i)=><a href="#contact" key={name}><span>0{i+1}</span><strong>{name}</strong><em>{i===0?"Show your work":i===1?"Start with confidence":i===2?"Built for growth":"Help when needed"}</em><b>↗</b></a>)}</div>
    </section>
    <section className="finish" id="contact"><small>READY WHEN YOU ARE</small><h2>Let&apos;s make your<br/><em>next move visible.</em></h2><a href="mailto:hello@webcloudsolutions.com.au">hello@webcloudsolutions.com.au ↗</a><footer><span>WEB CLOUD SOLUTIONS</span><span>GOLD COAST / AUSTRALIA</span><span>© 2026</span></footer></section>
  </main>;
}
