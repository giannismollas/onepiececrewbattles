import React, { useState, useEffect } from 'react';
import { History, Search, Filter, RotateCcw, Award, ArrowLeft, Swords } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export default function BattleHistory({ navigate }) {
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [endReason, setEndReason] = useState('ALL');
  const [sort, setSort] = useState('newest');

  const fetchHistory = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.append('search', search.trim());
    if (endReason !== 'ALL') params.append('endReason', endReason);
    if (sort) params.append('sort', sort);

    fetch(`/api/history?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setBattles(data.history || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [endReason, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    soundEffects.playButtonClick();
    fetchHistory();
  };

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      
      {/* HEADER BANNER */}
      <div className="gold-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History color="var(--gold-light)" size={24} />
              <span className="badge badge-gold font-pirate" style={{ fontSize: '1rem' }}>
                NAVAL CHRONICLES
              </span>
            </div>
            <h2 className="font-pirate text-gold" style={{ fontSize: '2.6rem', marginTop: '4px', lineHeight: 1.1 }}>
              BATTLE HISTORY ARCHIVES
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Permanent records of completed Grand Line naval engagements with interactive replays.
            </p>
          </div>

          <button className="btn btn-outline" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Return to Sea
          </button>
        </div>
      </div>

      {/* SEARCH & FILTERS TOOLBAR */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search by Lobby Code, Captain, Crew, or Ship..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-dark"
              style={{ paddingLeft: '38px' }}
            />
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* End Reason Filter */}
          <div style={{ minWidth: '180px' }}>
            <select 
              value={endReason}
              onChange={(e) => { soundEffects.playButtonClick(); setEndReason(e.target.value); }}
              className="input-dark"
            >
              <option value="ALL">All Outcomes</option>
              <option value="ENGINE_DESTROYED">Engine Destroyed</option>
              <option value="SURRENDER">Surrender</option>
              <option value="ADMIN_DECISION">Admin Decision</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div style={{ minWidth: '150px' }}>
            <select 
              value={sort}
              onChange={(e) => { soundEffects.playButtonClick(); setSort(e.target.value); }}
              className="input-dark"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          <button type="submit" className="btn btn-gold">
            <Search size={16} /> Filter
          </button>
        </form>
      </div>

      {/* BATTLES LIST */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <h3 className="font-pirate text-gold" style={{ fontSize: '2rem' }}>Retrieving Logbooks...</h3>
        </div>
      ) : battles.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Swords size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h3 className="font-pirate text-gold" style={{ fontSize: '2rem', marginBottom: '8px' }}>
            NO BATTLE RECORDS FOUND
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>
            No recorded engagements match your filter criteria. Commission a new battle lobby to make history!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {battles.map((b) => (
            <div key={b.id} className="gold-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span className="badge badge-gold font-pirate" style={{ fontSize: '1.05rem' }}>
                    {b.public_code}
                  </span>
                  <span className={`badge ${b.end_reason === 'ENGINE_DESTROYED' ? 'badge-crimson' : 'badge-seafoam'}`}>
                    {b.end_reason === 'ENGINE_DESTROYED' ? '💥 Engine Destroyed' : `🏳️ ${b.end_reason}`}
                  </span>
                </div>

                {/* Matchup */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0', textAlign: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--gold-light)', fontSize: '1.05rem' }}>
                      {b.winner_captain}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {b.winner_crew}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--seafoam-primary)', marginTop: '4px' }}>
                      🏆 Winner ({b.winner_ship})
                    </div>
                  </div>

                  <div style={{ padding: '0 10px', color: 'var(--crimson-primary)', fontWeight: 'bold', fontFamily: 'var(--font-cinzel)' }}>
                    VS
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.05rem' }}>
                      {b.loser_captain}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {b.loser_crew}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Defeated ({b.loser_ship})
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <div>
                  <span>⚔️ {b.rounds} Rounds</span> • <span>{new Date(b.created_at).toLocaleDateString()}</span>
                </div>

                <button 
                  className="btn btn-gold btn-sm"
                  onClick={() => {
                    soundEffects.playButtonClick();
                    navigate(`/replay/${b.public_code}`);
                  }}
                >
                  <RotateCcw size={14} /> Replay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
