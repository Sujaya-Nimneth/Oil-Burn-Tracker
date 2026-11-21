import type { RecessionBreakdown } from './recession-score';

export interface PredictionExpectation {
  label: string;
  value: string;
  detail: string;
}

export interface ScenarioPrediction {
  scenario: string;
  probability: number;
  color: string;
  what: string;
  why: string;
  how: string;
  when: string;
  expect: PredictionExpectation[];
}

export interface PredictionInputs {
  hormuzBlockedPct: number;
  productionPct: number;
  nuclearDestroyed: number;
  enrichmentPct: number;
  radiationRisk: 'none' | 'low' | 'elevated' | 'high';
  eventsLast7: number;
  warDays: number;
  totalCostBillions: number;
  totalKilled: number;
  oilPriceBbl: number;
  oilDelta: number;
  totalMonthlyExtra: number;
  recession: RecessionBreakdown;
}

export function computeScenarioPredictions(
  input: PredictionInputs
): ScenarioPrediction[] {
  const {
    hormuzBlockedPct: hormuzBlocked,
    productionPct,
    nuclearDestroyed,
    enrichmentPct,
    radiationRisk: radRisk,
    eventsLast7: tempo,
    warDays,
    totalCostBillions,
    totalKilled,
    oilPriceBbl,
    oilDelta,
    totalMonthlyExtra,
    recession
  } = input;

  const enrichmentGone = 100 - enrichmentPct;
  const formattedCost =
    totalCostBillions >= 1000
      ? `${(totalCostBillions / 1000).toFixed(1)}T`
      : `${totalCostBillions.toFixed(0)}B`;

  const predictions: ScenarioPrediction[] = [
    {
      scenario: 'Hormuz fully closed',
      probability: Math.min(
        95,
        Math.round(
          (hormuzBlocked > 50 ? 40 : hormuzBlocked > 20 ? 20 : 5) +
            (productionPct > 10 ? 20 : productionPct > 5 ? 10 : 0) +
            (tempo > 10 ? 15 : tempo > 5 ? 8 : 0) +
            (nuclearDestroyed >= 3 ? 15 : nuclearDestroyed >= 1 ? 5 : 0)
        )
      ),
      color: 'text-red-600',
      what: 'Iran deploys naval mines, fast-attack boats, and anti-ship missiles to seal the Strait of Hormuz — a 21-mile-wide chokepoint carrying 21M barrels/day (21% of global oil).',
      why: `Iran has publicly threatened Hormuz closure since the 1980s as its ultimate leverage. With ${nuclearDestroyed} nuclear facilities destroyed, retaliation via oil disruption is Iran's most powerful asymmetric weapon. They can't match US/Israeli military power, but they CAN crash the global economy.`,
      how: 'Iran has 3,000+ naval mines stockpiled, Khalij Fars anti-ship ballistic missiles, hundreds of fast-attack boats in IRGC Navy, and Noor/Qader cruise missiles covering the entire strait. Even partial mining would halt tanker insurance and stop commercial traffic.',
      when: `Most likely within days of a major escalation. Current Hormuz disruption: ${hormuzBlocked}%. Iran's doctrine says nuclear facility destruction = economic warfare response.`,
      expect: [
        {
          label: 'Oil price',
          value: '$200-300/bbl',
          detail: 'Instant spike — 21% of global supply gone'
        },
        {
          label: 'Gas price',
          value: '$8-12/gal',
          detail: 'Within 2-4 weeks as reserves deplete'
        },
        {
          label: 'US Strategic Reserve',
          value: '~350M barrels',
          detail: 'Lasts ~18 days at full draw (would be rationed)'
        },
        {
          label: 'Countries affected',
          value: '30+',
          detail:
            'Japan, S. Korea, India, China get 60-80% of oil through Hormuz'
        },
        {
          label: 'US military response',
          value: 'Minesweeping + escorts',
          detail:
            'Could take 3-6 months to fully clear — mines are cheap, clearing is slow'
        },
        {
          label: 'Insurance rates',
          value: 'Tankers uninsurable',
          detail:
            "Lloyd's of London would pull war-risk coverage — no insurance = no shipping"
        }
      ]
    },
    {
      scenario: 'Nuclear accident / meltdown',
      probability: Math.min(
        90,
        Math.round(
          (radRisk === 'high'
            ? 30
            : radRisk === 'elevated'
              ? 15
              : radRisk === 'low'
                ? 5
                : 1) +
            (nuclearDestroyed >= 4
              ? 25
              : nuclearDestroyed >= 2
                ? 12
                : nuclearDestroyed >= 1
                  ? 5
                  : 0) +
            (enrichmentGone > 70 ? 15 : enrichmentGone > 40 ? 8 : 0)
        )
      ),
      color: 'text-orange-600',
      what: 'A bombed nuclear facility suffers containment failure — radioactive material released into atmosphere and/or Persian Gulf waters. Bushehr (active reactor on the coast) is the highest risk.',
      why: `${nuclearDestroyed} facilities destroyed by airstrikes. Nuclear facilities aren't designed to be bombed — they're designed for earthquakes and accidents. Bunker busters can breach containment vessels, crack spent fuel pools, and scatter radioactive material. Radiation risk is currently "${radRisk}".`,
      how: 'Three paths to meltdown: (1) Bushehr reactor cooling disrupted by strike — fuel rods melt within hours. (2) Spent fuel pool at any facility breached — fire releases cesium-137. (3) Enrichment facility hit releases uranium hexafluoride gas — toxic and radioactive.',
      when: 'Could happen with the next strike on a nuclear facility. Bushehr is the most dangerous — it has an active core with 80+ tons of fuel. If cooling is lost, meltdown begins within 4-8 hours.',
      expect: [
        {
          label: 'Contamination zone',
          value: '50-300km radius',
          detail:
            'Depends on wind — could reach Kuwait, Bahrain, Qatar, Saudi Arabia'
        },
        {
          label: 'Evacuations',
          value: '2-10 million people',
          detail: 'Coastal Gulf populations within fallout range'
        },
        {
          label: 'Water supply',
          value: 'Gulf desalination offline',
          detail:
            "90% of Gulf states' drinking water comes from desalination — contaminated intake"
        },
        {
          label: 'Duration',
          value: '30+ years',
          detail: 'Chernobyl exclusion zone is still active 40 years later'
        },
        {
          label: 'Health impact',
          value: 'Cancer spike in 5-20 years',
          detail:
            'Thyroid, leukemia, birth defects — pattern seen after every nuclear accident'
        },
        {
          label: 'Global response',
          value: 'Immediate ceasefire pressure',
          detail:
            'A meltdown would likely force all parties to the table — but damage is done'
        }
      ]
    },
    {
      scenario: 'US ground troops in Iran',
      probability: Math.min(
        85,
        Math.round(
          (warDays > 400 ? 15 : warDays > 200 ? 8 : 2) +
            (totalCostBillions > 800 ? 15 : totalCostBillions > 400 ? 8 : 2) +
            (nuclearDestroyed >= 3 ? 12 : 0) +
            (tempo > 15 ? 10 : tempo > 8 ? 5 : 0)
        )
      ),
      color: 'text-red-700',
      what: 'Air campaign fails to stop Iranian retaliation. US commits ground forces to Iran — a country of 85 million people, 4x the size of Iraq, with mountainous terrain built for guerrilla warfare.',
      why: `After ${warDays} days of war and $${formattedCost} spent, air power alone hasn't achieved objectives. Iran continues launching missiles from dispersed mobile launchers. Political pressure builds to "finish the job."`,
      how: 'Likely starts with "limited" objectives — securing nuclear sites or a buffer zone. Iraq 2003 started the same way. Iran\'s IRGC has 190,000 troops + 600,000 Basij militia. Terrain is mountains, not desert — Afghanistan-style grinding warfare.',
      when: 'Historically takes 6-18 months of air campaign before ground invasion pressure becomes irresistible. US currently has 45,000 troops in the region but would need 300,000-500,000 for invasion.',
      expect: [
        {
          label: 'Troops needed',
          value: '300,000-500,000',
          detail: 'Iran is 3.5x larger than Iraq with triple the population'
        },
        {
          label: 'Cost',
          value: '$2-4 trillion',
          detail: 'Iraq cost $2.4T over 8 years — Iran would be worse'
        },
        {
          label: 'US casualties',
          value: '10,000-50,000',
          detail: "Iran's terrain and military are far more capable than Iraq's"
        },
        {
          label: 'Duration',
          value: '5-15 years',
          detail:
            'No modern power has successfully occupied Iran — not even the Mongols held it long'
        },
        {
          label: 'Draft',
          value: 'Likely necessary',
          detail:
            "Current volunteer military can't sustain 500K deployment + other commitments"
        },
        {
          label: 'Iran casualties',
          value: '100,000-500,000',
          detail:
            'Civilian and military — urban warfare in Tehran (9M pop) would be devastating'
        }
      ]
    },
    {
      scenario: 'Saudi infrastructure hit',
      probability: Math.min(
        90,
        Math.round(
          (nuclearDestroyed >= 2 ? 30 : nuclearDestroyed >= 1 ? 10 : 3) +
            (productionPct > 10 ? 20 : productionPct > 5 ? 10 : 3) +
            (tempo > 10 ? 15 : tempo > 5 ? 8 : 0) +
            (hormuzBlocked > 30 ? 10 : 0)
        )
      ),
      color: 'text-orange-700',
      what: "Iran launches ballistic missiles at Saudi Aramco's Abqaiq processing facility and Khurais oil field — the heart of Saudi oil production. Abqaiq alone processes 7M BPD (7% of global supply).",
      why: `Iran's nuclear facilities are being destroyed — retaliation against US allies' economic infrastructure is the logical asymmetric response. Iran proved it can hit Abqaiq in 2019 (drone/cruise missile attack knocked out 5.7M BPD for weeks). With ${nuclearDestroyed} facilities gone, the calculus shifts toward maximum economic damage.`,
      how: '2019 attack used 18 drones + 7 cruise missiles and evaded Saudi/US air defenses. Iran now has hypersonic Fattah missiles (Mach 13+) that current missile defense cannot intercept. Also has Houthi proxies in Yemen who can attack from the south.',
      when: 'Most likely as retaliation for nuclear facility strikes. Could come as a coordinated wave — Abqaiq + Ras Tanura (largest oil export terminal) + Khurais simultaneously.',
      expect: [
        {
          label: 'Supply offline',
          value: '7-10M BPD',
          detail: 'Abqaiq (7M) + Khurais (1.5M) + Ras Tanura exports'
        },
        {
          label: 'Oil price',
          value: '$180-250/bbl',
          detail:
            '2019 attack (5.7M BPD) caused 15% spike in ONE DAY — this would be worse'
        },
        {
          label: 'Repair time',
          value: '6-18 months',
          detail:
            '2019 took weeks to repair with NO military conflict — under war conditions, much longer'
        },
        {
          label: 'Gas rationing',
          value: 'Likely in US/Europe',
          detail: 'Strategic reserves buy 2-3 months — after that, rationing'
        },
        {
          label: 'Saudi response',
          value: 'Joins war or neutrality',
          detail:
            'Saudi has been trying to stay neutral — a direct hit forces their hand'
        },
        {
          label: 'Global GDP',
          value: '-2% to -4%',
          detail:
            'IMF models show oil above $150 sustained = global recession within 6 months'
        }
      ]
    },
    {
      scenario: 'Ceasefire within 90 days',
      probability: Math.max(
        2,
        Math.min(
          60,
          Math.round(
            40 -
              (nuclearDestroyed >= 3 ? 15 : nuclearDestroyed >= 1 ? 8 : 0) -
              (productionPct > 15 ? 15 : productionPct > 8 ? 8 : 0) -
              (tempo > 12 ? 10 : tempo > 6 ? 5 : 0) -
              (totalKilled > 60000 ? 10 : totalKilled > 30000 ? 5 : 0)
          )
        )
      ),
      color: 'text-green-700',
      what: "International pressure — especially from China (Iran's biggest oil customer) and US domestic politics — forces a ceasefire. Both sides claim victory, fighting stops, reconstruction begins.",
      why: `Ceasefire probability drops as destruction increases. With ${totalKilled.toLocaleString()} killed and ${productionPct.toFixed(1)}% of oil offline, both sides have strong incentives to stop — but also strong incentives to "finish" what they started. The paradox: the worse it gets, the harder it is to stop.`,
      how: 'Most likely path: China threatens to cut off remaining Iranian trade + US faces election pressure + oil prices make ceasefire economically urgent. UN Security Council resolution with monitoring. Gradual de-escalation over weeks.',
      when: "Historical pattern: wars like this burn hot for 3-6 months before exhaustion sets in. Key trigger would be a nuclear accident or oil price above $200 — something so catastrophic it forces all parties' hands.",
      expect: [
        {
          label: 'Oil recovery',
          value: '6-12 months to $90-100',
          detail: 'Markets recover fast once shipping lanes reopen'
        },
        {
          label: 'Gas price',
          value: 'Back to $3.50-4.50',
          detail: '3-6 months after ceasefire for supply chain normalization'
        },
        {
          label: 'Iran nuclear',
          value: 'IAEA inspections resume',
          detail:
            'New deal likely — more restrictive than JCPOA, with verification'
        },
        {
          label: 'Reconstruction',
          value: '$500B-1T needed',
          detail: 'Iran, Gaza, Lebanon infrastructure devastated — who pays?'
        },
        {
          label: 'Household savings',
          value: '+$500-800/mo back',
          detail:
            'Energy and grocery costs gradually return toward pre-war levels'
        },
        {
          label: 'Political fallout',
          value: 'Major',
          detail:
            'Investigations, war crimes tribunals, realignment of Middle East alliances'
        }
      ]
    },
    {
      scenario: 'US recession (12-month)',
      probability: recession.score,
      color:
        recession.score >= 60
          ? 'text-red-600'
          : recession.score >= 40
            ? 'text-orange-600'
            : 'text-blue-600',
      what: 'The combination of energy shock, consumer price inflation, war spending, and supply chain disruption tips the US economy into recession — GDP contracts for 2+ consecutive quarters.',
      why: `Every major oil price shock since 1973 has been followed by a recession. Current oil at $${oilPriceBbl}/bbl is ${oilDelta > 0 ? `$${oilDelta.toFixed(0)} above` : 'at'} pre-war levels. Households paying +$${totalMonthlyExtra}/mo extra means less consumer spending — and consumer spending is 70% of US GDP.`,
      how: 'The transmission chain: oil spike → gas/energy costs up → trucking/shipping costs up → food and goods prices up → consumers cut spending → businesses cut staff → unemployment rises → recession. This typically takes 6-12 months to fully play out.',
      when: `Based on current stress indicators: oil shock ${recession.oilSpikePct}/100, supply disruption ${recession.supplyRisk}/100, inflation ${recession.inflationPressure}/100. Historical precedent: 1973 embargo → recession in 8 months. 1979 Iranian revolution → recession in 10 months.`,
      expect: [
        {
          label: 'GDP contraction',
          value: '-1.5% to -3.5%',
          detail:
            '1973 oil crisis caused -3.2% — current conditions are comparable'
        },
        {
          label: 'Unemployment',
          value: '6-9%',
          detail: 'Currently ~4% — recession typically adds 2-5 points'
        },
        {
          label: 'Stock market',
          value: '-25% to -40%',
          detail: 'S&P 500 typically drops 30%+ in oil-shock recessions'
        },
        {
          label: 'Housing',
          value: '-10% to -20%',
          detail:
            'Mortgage rates spike with inflation — fewer buyers, prices drop'
        },
        {
          label: 'Duration',
          value: '12-24 months',
          detail:
            'Oil-shock recessions last longer than financial ones — structural damage'
        },
        {
          label: 'Fed response',
          value: 'Stagflation trap',
          detail:
            "Can't cut rates (inflation) or raise rates (recession) — worst scenario for central banks"
        }
      ]
    },
    {
      scenario: 'Global oil embargo (OPEC)',
      probability: Math.min(
        80,
        Math.round(
          (totalKilled > 50000 ? 20 : totalKilled > 20000 ? 10 : 3) +
            (nuclearDestroyed >= 2 ? 15 : 5) +
            (productionPct > 10 ? 10 : 3) +
            (tempo > 10 ? 8 : 2)
        )
      ),
      color: 'text-red-600',
      what: 'OPEC members — especially Saudi Arabia, UAE, Kuwait — cut oil production in solidarity with Iran or under domestic political pressure from populations outraged by the destruction. 1973 Arab oil embargo repeat.',
      why: `${totalKilled.toLocaleString()} killed, nuclear facilities bombed, and a Muslim-majority country under sustained assault. Arab street pressure on Gulf monarchies is intense. In 1973, Arab nations embargoed the US over far less provocation (support for Israel in Yom Kippur War). Current situation is worse.`,
      how: 'OPEC+ controls 40% of global oil production. Even a 10% cut crashes markets. Could come as: (1) Full embargo of US/allies, (2) Production cuts "for stability," or (3) Individual countries cutting output under domestic pressure. Saudi Arabia\'s MBS has shown willingness to use oil as a weapon (2020 price war with Russia).',
      when: 'Trigger events: a nuclear accident, civilian massacre on live TV, or mosque/holy site destruction. Arab League emergency session → OPEC emergency meeting → production cuts within 48 hours.',
      expect: [
        {
          label: 'Oil price',
          value: '$250-400/bbl',
          detail:
            "1973 embargo quadrupled oil prices — same multiplier on today's base = $300+"
        },
        {
          label: 'Gas price',
          value: '$10-15/gal',
          detail: 'Within 4-8 weeks — stations running dry in many areas'
        },
        {
          label: 'US Strategic Reserve',
          value: 'Depleted in 60-90 days',
          detail: '~350M barrels at emergency draw rate — not enough'
        },
        {
          label: 'Rationing',
          value: 'Mandatory',
          detail:
            'Federal fuel rationing — odd/even license plate days, limits per vehicle'
        },
        {
          label: 'Food prices',
          value: '+50-80%',
          detail: 'Everything moves by truck — diesel doubles, food follows'
        },
        {
          label: 'Global impact',
          value: 'Depression-level',
          detail:
            "Developing nations can't afford oil — famines, political instability, mass migration"
        }
      ]
    },
    {
      scenario: 'Russia/China direct involvement',
      probability: Math.min(
        70,
        Math.round(
          (totalCostBillions > 1000 ? 15 : totalCostBillions > 500 ? 8 : 2) +
            (nuclearDestroyed >= 4 ? 12 : nuclearDestroyed >= 2 ? 5 : 0) +
            (productionPct > 15 ? 10 : 3) +
            (warDays > 300 ? 8 : warDays > 100 ? 3 : 0)
        )
      ),
      color: 'text-red-800',
      what: 'Russia and/or China move from diplomatic protests to direct military or economic intervention — weapons shipments, naval deployments, sanctions counter-measures, or outright military support for Iran.',
      why: `This is about the global power balance, not just Iran. If the US/Israel can destroy a nation's nuclear program and reshape the Middle East without consequences, it sets a precedent that threatens both Russia and China's security calculations. Iran is a major arms customer for Russia and China's #3 oil supplier. With $${formattedCost} in war costs, the US is weakened — and both rivals see opportunity.`,
      how: 'Escalation ladder with multiple rungs, each more dangerous than the last.',
      when: `Trigger points: (1) Nuclear facility strike (already ${nuclearDestroyed} destroyed) threatens nuclear non-proliferation norm. (2) Oil above $200 hurts China's economy — they have incentive to end the war OR back Iran. (3) US gets bogged down → Russia sees opportunity in Europe/Arctic.`,
      expect: [
        {
          label: 'China — economic',
          value: 'Most likely first step',
          detail:
            'Defies sanctions openly, buys all Iranian oil, provides financial system access via CIPS (alternative to SWIFT). Already does this partially — would go all-in.'
        },
        {
          label: 'China — military',
          value: 'Naval escort of oil tankers',
          detail:
            'PLA Navy deploys to Persian Gulf to escort Chinese-flagged tankers through Hormuz. Dares US to fire on Chinese warships. Precedent: China already has a base in Djibouti.'
        },
        {
          label: "China — why they'd act",
          value: 'Oil dependency + Taiwan',
          detail:
            "China imports 72% of its oil, 45% through Hormuz. A closed Hormuz devastates China's economy. Also: if US is tied down in Iran, Taiwan window opens. US can't fight two wars."
        },
        {
          label: 'Russia — weapons',
          value: 'S-400 + Kinzhal to Iran',
          detail:
            'Advanced air defense systems would negate US/Israeli air superiority. Hypersonic missiles would threaten US carriers. Russia already sold S-300 to Iran and has discussed S-400.'
        },
        {
          label: 'Russia — military',
          value: 'Escalation in Europe',
          detail:
            'With US forces concentrated in Middle East, Russia tests NATO boundaries — Baltic states, Finland, increased nuclear posturing. Not direct intervention in Iran, but exploiting US overextension.'
        },
        {
          label: "Russia — why they'd act",
          value: 'Precedent + profit',
          detail:
            "If US can destroy nuclear programs at will, Russia's own deterrent logic is threatened. Plus: oil at $200+ is pure profit for Russia as the world's #2 producer. They benefit from chaos."
        },
        {
          label: 'Red line — nuclear',
          value: 'Bushehr meltdown',
          detail:
            "A nuclear accident contaminating the Caspian region (Russia's border) or threatening Chinese energy supply would force both powers to act. Environmental disaster = national security threat."
        },
        {
          label: 'Red line — ground war',
          value: 'US invades Iran',
          detail:
            "A US ground invasion of Iran puts NATO troops on Russia's sphere of influence and China's Belt & Road partner. Both have defense agreements. This is the Cuba scenario in reverse."
        }
      ]
    }
  ];

  return predictions.sort((a, b) => b.probability - a.probability);
}
