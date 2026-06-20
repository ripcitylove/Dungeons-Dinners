"use client";

import { useState, useEffect } from 'react';
import { getTheme, onThemeChange, type Theme } from '../../lib/theme';
import { useRouter } from 'next/navigation';
import '../globals.css';

import { supabase } from '../../lib/supabaseClient';
import { characterNameError } from '../../lib/nameValidation';
import { getSpellCounts } from '../../lib/spellData';
import { CLASS_PROFICIENCIES } from '../../lib/proficiencyData';
import { useTooltip, tipBox } from '../../hooks/useTooltip';
import { STAT_TIPS } from '../../lib/tooltipData';
import { armorInventoryEntry } from '../../lib/equipmentData';
import {
  CharacterSteps, emptyForm, type CharForm,
  D20Icon, STEP_ICONS, STEP_TITLES, STAT_LEGEND,
  startingHP, isSpellcasterForm, totalStepsForForm, isRollUnrolled,
} from '../../components/CharacterSteps';

export default function CreateCharacter() {
  const router = useRouter();

  const [form, setForm]   = useState<CharForm>(() => emptyForm());
  // Start on the SSR-stable default so server and client agree (no hydration
  // mismatch), then apply the saved theme on mount — a real state change that
  // forces the data-theme attribute to update. Keeps the global toggle instant.
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { setTheme(getTheme()); return onThemeChange(setTheme); }, []);
  const [step, setStep]   = useState(1);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [portraitGenerating, setPortraitGenerating] = useState(false);

  const { showTooltip, hideTooltip, TooltipPortal } = useTooltip();

  const patch = (p: Partial<CharForm>) => setForm(f => ({ ...f, ...p }));

  const spellCounts  = getSpellCounts(form.class, form.scores);
  const isSpellcaster = isSpellcasterForm(form);
  const totalSteps    = totalStepsForForm(form);
  const profRequired  = form.class ? (CLASS_PROFICIENCIES[form.class]?.skillChoices.count ?? 0) : 0;
  const stepTitle     = STEP_TITLES[step - 1];

  const spellsReady =
    (spellCounts.cantrips === 0 || form.cantrips.length === spellCounts.cantrips) &&
    (spellCounts.spells   === 0 || form.spells.length   === spellCounts.spells);

  const canProceed =
    (step === 1 && !!form.race) ||
    (step === 2 && !!form.class && form.skillProficiencies.length === profRequired) ||
    (step === 3 && !isRollUnrolled(form)) ||
    (step === 4 && !!form.weapon) ||
    (step === 5) ||
    (step === 6);

  const nextStep = () => {
    if (step === 1) {
      const nameErr = characterNameError(form.name);
      if (nameErr) { setNameError(nameErr); return; }
      if (!form.race) return;
    }
    if (step === 2) {
      if (!form.class) return;
      if (form.skillProficiencies.length < profRequired) return;
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("You must be logged in!"); router.push('/auth'); return; }

      const trimmedName = form.name.trim();
      const nameErr = characterNameError(trimmedName);
      if (nameErr) { setStep(1); setNameError(nameErr); setSaving(false); return; }

      const { count: rosterCount } = await supabase
        .from('characters').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      if ((rosterCount ?? 0) >= 40) {
        setStep(1);
        setNameError(`Your roster is full (40 / 40). Delete a character from the dashboard to make room.`);
        setSaving(false); return;
      }

      const { data: existing } = await supabase
        .from('characters').select('id').ilike('name', trimmedName).limit(1);
      if (existing && existing.length > 0) {
        setStep(1);
        setNameError(`"${trimmedName}" is already taken by another adventurer. Choose a different name.`);
        setSaving(false); return;
      }

      const charClass   = form.class || 'Fighter';
      const finalScores = form.scores;
      const maxHp       = startingHP(charClass, finalScores.constitution);
      const startingInv = {
        gold: 50,
        weapons: [...(form.weapon ? [form.weapon] : ['Iron Dagger']), ...(form.offHand ? [form.offHand] : [])],
        items: [
          'Bedroll', 'Rations (5 days)',
          armorInventoryEntry(form.armor),
          ...(form.shield ? ['Shield'] : []),
          ...(form.trinket.trim() ? [form.trinket.trim()] : []),
        ],
      };

      const { data: newChar, error: insertError } = await supabase.from('characters').insert([{
        user_id:              user.id,
        name:                 trimmedName,
        race:                 form.race || 'Human',
        class:                charClass,
        sex:                  form.sex,
        title:                form.title.trim() || null,
        alignment:            form.alignment || null,
        background:           form.background.trim() || null,
        skill_proficiencies:  form.skillProficiencies,
        level:                1,
        xp:                   0,
        max_hp:               maxHp,
        hp:                   maxHp,
        strength:             finalScores.strength,
        dexterity:            finalScores.dexterity,
        constitution:         finalScores.constitution,
        intelligence:         finalScores.intelligence,
        wisdom:               finalScores.wisdom,
        charisma:             finalScores.charisma,
        inventory:            startingInv,
        cantrips_known:       form.cantrips,
        spells_prepared:      form.spells,
        spell_slots_used:     {},
        status_effects:       [],
      }]).select().single();

      if (insertError || !newChar) throw insertError ?? new Error("Insert failed");

      setSaving(false);
      setPortraitGenerating(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        await fetch('/api/generate-portrait', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            race: form.race || 'Human', cls: charClass, sex: form.sex, charId: newChar.id,
            title: form.title.trim() || null, alignment: form.alignment || null, background: form.background.trim() || null,
          }),
        });
      } catch (portraitErr) {
        console.error('[create-character] portrait fetch error:', portraitErr);
      }

      router.push('/dashboard');
    } catch (err) {
      console.error("Error saving character:", err);
      alert("Failed to save character. Please try again.");
      setSaving(false);
    }
  };

  return (
    <main className="themed-page" data-theme={theme} style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', background: 'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(139,92,246,0.09) 0%, transparent 70%), var(--canvas-bg)' }}>

      {/* Portrait generation overlay */}
      {portraitGenerating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,3,15,0.95)', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🎨</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '10px' }}>Painting your portrait…</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '28px', lineHeight: 1.6 }}>The artist captures your likeness in ink and magic.<br />This takes about 20 seconds.</p>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
              {[0, 1, 2].map(i => (<div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', animation: `blink 1.2s step-end ${i * 0.4}s infinite` }} />))}
            </div>
          </div>
          <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }`}</style>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', width: '100%', maxWidth: '1280px', justifyContent: 'center', flexWrap: 'wrap' }}>

        {/* Left rail — Ability Score legend (always visible). Hides below 900px wide. */}
        <aside className="hide-on-narrow" style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '40px' }}>
          <div className="glass-panel" style={{ padding: '20px 18px' }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Reference</div>
            <h3 style={{ fontSize: '1rem', margin: 0, marginBottom: '14px', color: 'var(--foreground)', fontWeight: 600 }}>Ability Scores</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {STAT_LEGEND.map(s => {
                const t = STAT_TIPS[s.code];
                return (
                  <div key={s.code}
                    onMouseEnter={e => { if (t) showTooltip(tipBox(t.title, t.body, s.color), e); }}
                    onMouseLeave={hideTooltip}
                    style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 10px', borderRadius: '8px', background: 'var(--inset-bg)', border: `1px solid ${s.color}33`, cursor: 'help', transition: 'border-color 0.15s' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: s.color, letterSpacing: '0.05em' }}>{s.code}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--subtle)', lineHeight: 1.35 }}>{s.line}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '14px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)', fontSize: '0.68rem', color: 'var(--accent-strong)', lineHeight: 1.45, cursor: 'help' }}
              onMouseEnter={e => showTooltip(tipBox('Ability Modifier', 'Your modifier = (score − 10) ÷ 2, rounded down. Added to every roll made with that ability (attack, save, skill check).', '#c4b5fd'), e)}
              onMouseLeave={hideTooltip}>
              <strong style={{ color: 'var(--accent-strong)' }}>Modifier:</strong> (score − 10) ÷ 2, rounded down. Hover for details.
            </div>
          </div>
        </aside>
        <style>{`@media (max-width: 900px) { .hide-on-narrow { display: none !important; } }`}</style>

        <div className="glass-panel" style={{ flex: '1 1 0', minWidth: 0, maxWidth: '1020px', padding: '52px 56px', position: 'relative' }}>

          {/* Progress bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', zIndex: 0, background: `linear-gradient(90deg, var(--primary) ${Math.max(0, ((step - 1) / (totalSteps - 1)) * 100)}%, var(--border) ${Math.max(0, ((step - 1) / (totalSteps - 1)) * 100)}%)` }} />
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(i => {
              const stepLabels = ["Identity — name, race, sex, alignment", "Class — role, proficiencies, skills", "Ability Scores — your six stats", "Equipment — weapon and shield", "Background — backstory for the DM", "Spells — cantrips and prepared spells"];
              const done = step > i; const active = step === i;
              return (
                <div key={i}
                  onMouseEnter={e => showTooltip(tipBox(`${STEP_ICONS[i-1]} Step ${i}`, stepLabels[i - 1] ?? '', step >= i ? '#8b5cf6' : 'var(--muted)'), e)}
                  onMouseLeave={hideTooltip}
                  style={{ width: '46px', height: '46px', borderRadius: '50%', background: done ? 'linear-gradient(135deg, var(--primary), #6d28d9)' : active ? 'rgba(139,92,246,0.22)' : 'var(--card-bg)', border: `2px solid ${step >= i ? 'var(--primary)' : 'var(--border)'}`, boxShadow: done ? '0 0 16px rgba(139,92,246,0.6)' : active ? '0 0 10px rgba(139,92,246,0.35), 0 0 0 3px rgba(139,92,246,0.12)' : 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1, color: step >= i ? 'white' : '#475569', fontWeight: 'bold', fontSize: done ? '0.82rem' : '1rem', cursor: 'help', transition: 'all 0.3s' }}>{done ? '✓' : i}</div>
              );
            })}
          </div>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '2.6rem', marginBottom: '8px', lineHeight: 1, display: 'flex', justifyContent: 'center' }}>
              {step === 1 ? <D20Icon size={58} /> : <span>{STEP_ICONS[step - 1]}</span>}
            </div>
            <h1 className="shimmer-heading" style={{ fontSize: '2.6rem', marginBottom: 0 }}>{stepTitle}</h1>
            <div style={{ height: '1px', width: '80px', background: 'linear-gradient(90deg, transparent, var(--primary), transparent)', margin: '10px auto 0' }} />
          </div>

          {/* Shared step content — single source of truth (see components/CharacterSteps.tsx) */}
          <div style={{ minHeight: '340px' }}>
            <CharacterSteps step={step} form={form} patch={patch} showTooltip={showTooltip} hideTooltip={hideTooltip} nameError={nameError} setNameError={setNameError}
              onGuideRestart={() => { setForm(emptyForm()); setStep(1); setNameError(''); }} />
          </div>

          {/* Footer Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <button className="btn-secondary" onClick={step === 1 ? () => router.push('/dashboard') : prevStep}>{step === 1 ? 'Cancel' : 'Back'}</button>
            {step < totalSteps ? (
              <button className="btn-primary" data-guide="g-next" onClick={nextStep} disabled={!canProceed}>Next Step</button>
            ) : (
              <button className="btn-primary" data-guide="g-next" onClick={handleFinish} disabled={saving || portraitGenerating || (isSpellcaster && !spellsReady)} style={{ background: 'var(--accent)' }}>{saving ? 'Creating…' : 'Complete Character'}</button>
            )}
          </div>

        </div>
      </div>
      {TooltipPortal}
    </main>
  );
}
