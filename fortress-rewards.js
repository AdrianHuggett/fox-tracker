(function () {
  'use strict';

  var root, state, storageKey, shownCount = '', gameMsg = '', gameGone = [], goneArmed = null;
  var nextId = 1;
  function id() { return String(Date.now()) + '-' + String(nextId++); }
  var SITES = [
    { id: 'f1', label: 'Fortress No. 1', amount: 60 },
    { id: 'f2', label: 'Fortress No. 2', amount: 200 },
    { id: 'f3', label: 'Fortress No. 3', amount: 90 },
    { id: 'f4', label: 'Fortress No. 4', amount: 400, specialName: '1h Speedups', specialCap: 10 },
    { id: 'f5', label: 'Fortress No. 5', amount: 60 },
    { id: 'f6', label: 'Fortress No. 6', amount: 200 },
    { id: 'f7', label: 'Fortress No. 7', amount: 90 },
    { id: 'f8', label: 'Fortress No. 8', amount: 400, specialName: '1h Speedups', specialCap: 10 },
    { id: 'f9', label: 'Fortress No. 9', amount: 60 },
    { id: 'f10', label: 'Fortress No. 10', amount: 200 },
    { id: 'f11', label: 'Fortress No. 11', amount: 90 },
    { id: 'f12', label: 'Fortress No. 12', amount: 400, specialName: '1h Speedups', specialCap: 10 },
    { id: 's1', label: 'Stronghold No. 1', amount: 100, specialName: 'Pet Chests', specialCap: 3 },
    { id: 's2', label: 'Stronghold No. 2', amount: 420 },
    { id: 's3', label: 'Stronghold No. 3', amount: 600 },
    { id: 's4', label: 'Stronghold No. 4', amount: 150 }
  ];
  /* Roles: R1 to R5 share the rewards by contribution; only Max always receives the per-player maximum.
     (11 Nov 2026: R4/R5 briefly became Max; restoreRanks() gives them back their R4/R5 role once.) */
  var ROLES = ['r1', 'r2', 'r3', 'r4', 'r5', 'max'];
  var ROLE_ORDER = { max: 0, r5: 1, r4: 2, r3: 3, r2: 4, r1: 5 };
  function normRole(role) { return ROLES.indexOf(role) >= 0 ? role : 'r1'; }
  function roleLabel(role) { return role === 'max' ? 'Max' : String(role).toUpperCase(); }
  function isMax(member) { return member.role === 'max'; }
  var LEADERS = [
    { name: 'Jim Lahey', role: 'r5' },
    { name: 'Lord Solo', role: 'r4' },
    { name: 'ADRIAN', role: 'r4' },
    { name: 'xxLUNAxx', role: 'r4' },
    { name: 'SkyMnky', role: 'r4' },
    { name: 'Talie', role: 'r4' },
    { name: 'RiMa', role: 'r4' },
    { name: 'PinkTaco', role: 'r4' },
    { name: 'MayBJulian', role: 'r4' },
    { name: 'Chlebooo69', role: 'r4' },
    { name: 'icardifox', role: 'r4' },
    { name: 'Ricky Lahey', role: 'r4', excluded: true }
  ];
  function empty() { return { members: [], rewards: [], sites: [], allocation: {}, leadersSeeded: false, rosterVersion: 0 }; }
  function seedLeaders() {
    if (state.leadersSeeded) return;
    LEADERS.forEach(function (leader) {
      var member = state.members.find(function (m) { return m.name.toLowerCase() === leader.name.toLowerCase(); });
      if (member) { member.role = normRole(leader.role); member.excluded = !!leader.excluded; }
      else state.members.push({ id: id(), name: leader.name, role: normRole(leader.role), excluded: !!leader.excluded });
    });
    state.leadersSeeded = true;
    save();
  }
  function seedRoster() {
    if (state.rosterVersion === 1 || !Array.isArray(window.FOXFortressRoster)) return;
    window.FOXFortressRoster.forEach(function (row) {
      var member = state.members.find(function (m) { return m.name.toLowerCase() === row[1].toLowerCase(); });
      if (!member) {
        member = { id: id(), name: row[1], contribution: 1, excluded: false };
        state.members.push(member);
      }
      member.rank = row[0];
      member.role = normRole(row[2]);
      member.power = row[3];
      if (row[1] === 'Ricky Lahey') member.excluded = true;
    });
    state.members.sort(function (a, b) { return (a.rank || 999) - (b.rank || 999); });
    state.rosterVersion = 1;
    save();
  }
  function restoreRanks() {
    if (state.rolesVersion === 2) return;
    var known = {};
    LEADERS.forEach(function (leader) { known[leader.name.toLowerCase()] = leader.role; });
    (window.FOXFortressRoster || []).forEach(function (row) { if (row[2] === 'r4' || row[2] === 'r5') known[row[1].toLowerCase()] = row[2]; });
    state.members.forEach(function (member) {
      var rank = known[member.name.toLowerCase()];
      if (member.role === 'max' && (rank === 'r4' || rank === 'r5')) member.role = rank;
    });
    state.rolesVersion = 2;
    save();
  }
  function applyKnownRewardLimits() {
    if (state.rewardPresetsVersion === 1) return;
    state.rewards.forEach(function (reward) {
      var site = SITES.find(function (item) {
        return reward.id === item.id + '-chests' || reward.id === item.id + '-special';
      });
      if (!site) return;
      if (reward.id === site.id + '-chests' && !integer(reward.cap)) reward.cap = site.id.charAt(0) === 'f' ? 1 : 2;
      if (reward.id === site.id + '-special') {
        if (site.specialCap && !integer(reward.cap)) reward.cap = site.specialCap;
        if (site.specialName && reward.name === site.label + ' special reward') reward.name = site.label + ' ' + site.specialName;
      }
    });
    state.rewardPresetsVersion = 1;
    save();
  }
  function includedMembers() { return state.members.filter(function (member) { return !member.excluded; }); }
  function byName(a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }); }
  /* "role": Max, R5, R4, R3, R2, R1, then by name; "name": by name only; "power": strongest first, then by name. */
  var SORTS = ['role', 'name', 'power'];
  function sortMode(value, fallback) { return SORTS.indexOf(value) >= 0 ? value : fallback; }
  function sortedMembers(list, mode) {
    return list.slice().sort(function (a, b) {
      var first = mode === 'role' ? ROLE_ORDER[a.role] - ROLE_ORDER[b.role] : mode === 'power' ? powerNumber(b.power) - powerNumber(a.power) : 0;
      return first || byName(a, b);
    });
  }
  /* Power as the game shows it: 432.6M, 1.25B. */
  function powerLabel(value) {
    var n = powerNumber(value);
    return !n ? '–' : n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
  }
  function sortButtons(kind, mode, label) {
    return '<div class="fr-sort" role="group" aria-label="' + label + '">' + [['role', 'Sort by role'], ['name', 'Sort by name'], ['power', 'Sort by power']].map(function (o) {
      return '<button type="button" data-sort-' + kind + '="' + o[0] + '" aria-pressed="' + (mode === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function fullMembers() { return includedMembers().filter(isMax); }
  function integer(value) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100000, Math.floor(n))) : 0;
  }
  function contribution(member) {
    var n = Number(member.contribution);
    return Number.isFinite(n) && n >= 1 ? Math.min(4, Math.floor(n)) : 1;
  }
  function powerNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1000000000000, Math.floor(n))) : 0;
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Array.isArray(saved.members) && Array.isArray(saved.rewards)) {
        state = saved;
        state.sites = Array.isArray(state.sites) ? state.sites : [];
        state.allocation = state.allocation || {};
        state.members.forEach(function (member) { member.role = normRole(member.role); });
        seedLeaders();
        seedRoster();
        restoreRanks();
        applyKnownRewardLimits();
        return;
      }
    } catch (e) { /* Start with an empty draft if browser storage is unavailable. */ }
    state = empty();
    seedLeaders();
    seedRoster();
    restoreRanks();
    applyKnownRewardLimits();
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* Export remains available. */ }
  }
  function assigned(reward, member) {
    if (member.excluded) return 0;
    return integer((state.allocation[reward.id] || {})[member.id]);
  }
  function setAssigned(reward, member, count) {
    if (!state.allocation[reward.id]) state.allocation[reward.id] = {};
    state.allocation[reward.id][member.id] = integer(count);
  }
  function rewardTotal(reward) {
    return includedMembers().reduce(function (sum, member) { return sum + assigned(reward, member); }, 0);
  }
  function memberTotal(member) {
    return state.rewards.reduce(function (sum, reward) { return sum + assigned(reward, member); }, 0);
  }
  function stats() {
    var available = 0, allocated = 0, issues = [];
    state.rewards.forEach(function (reward) {
      var quantity = integer(reward.quantity), total = rewardTotal(reward), cap = integer(reward.cap);
      available += quantity;
      allocated += total;
      if (total > quantity) issues.push(reward.name + ': ' + (total - quantity) + ' above available quantity.');
      includedMembers().forEach(function (member) {
        if (cap && assigned(reward, member) > cap)
          issues.push(member.name + ' / ' + reward.name + ': above per-player limit.');
      });
      if (fullMembers().length) {
        if (!cap) issues.push(reward.name + ': set the per-player maximum for Max members.');
        else if (fullMembers().length * cap > quantity)
          issues.push(reward.name + ': not enough rewards to give every Max member the maximum.');
        else {
          var missing = fullMembers().filter(function (member) { return assigned(reward, member) !== cap; }).length;
          if (missing) issues.push(reward.name + ': ' + missing + ' Max members are not at the maximum.');
        }
      }
    });
    return { available: available, allocated: allocated, issues: issues };
  }
  function propose() {
    if (state.rewards.some(function (reward) { return integer(reward.quantity) > 5000; })) {
      message('Automatic proposals support up to 5,000 units per reward pool.');
      return;
    }
    var leaders = fullMembers();
    var impossible = state.rewards.find(function (reward) {
      return leaders.length && (!integer(reward.cap) || leaders.length * integer(reward.cap) > integer(reward.quantity));
    });
    if (impossible) {
      message(impossible.name + ': enter a per-player limit and enough rewards for every Max member.');
      return;
    }
    var awarded = {};
    includedMembers().forEach(function (member) { awarded[member.id] = 0; });
    state.allocation = {};
    state.rewards.forEach(function (reward) {
      var quantity = integer(reward.quantity), cap = integer(reward.cap);
      leaders.forEach(function (member) { setAssigned(reward, member, cap); awarded[member.id] += cap; });
      for (var unit = leaders.length * cap; unit < quantity; unit++) {
        var candidates = includedMembers().filter(function (member) {
          return !cap || assigned(reward, member) < cap;
        });
        if (!candidates.length) break;
        candidates.sort(function (a, b) {
          return (assigned(reward, a) + 1) / contribution(a) - (assigned(reward, b) + 1) / contribution(b) ||
            (awarded[a.id] + 1) / contribution(a) - (awarded[b.id] + 1) / contribution(b) ||
            state.members.indexOf(a) - state.members.indexOf(b);
        });
        setAssigned(reward, candidates[0], assigned(reward, candidates[0]) + 1);
        awarded[candidates[0].id]++;
      }
    });
    save();
    render();
  }
  function roleOptions(member) {
    return ROLES.map(function (role) {
      return '<option value="' + role + '"' + (member.role === role ? ' selected' : '') + '>' + roleLabel(role) + '</option>';
    }).join('');
  }
  function contributionOptions(member) {
    return [1, 2, 3, 4].map(function (value) {
      return '<option value="' + value + '"' + (contribution(member) === value ? ' selected' : '') + '>' + value + '</option>';
    }).join('');
  }
  function render() {
    if (!root) return;
    var oldSearch = root.querySelector('#fr-member-search');
    var searchText = oldSearch ? oldSearch.value : '';
    var oldList = root.querySelector('.fr-members-scroll');
    var listScroll = oldList ? oldList.scrollTop : 0;
    var s = stats();
    var memberSort = sortMode(state.memberSort, 'role'), allocSort = sortMode(state.allocSort, 'name');
    var memberRows = sortedMembers(state.members, memberSort).map(function (member) {
      return '<tr data-member-name="' + escapeHTML(member.name.toLowerCase()) + '" class="' + (member.excluded ? 'fr-ignored' : '') + '"><th scope="row"><div class="fr-member-name"><input type="text" maxlength="60" value="' + escapeHTML(member.name) + '" data-member="' + member.id + '" data-field="name" aria-label="Member name"><button type="button" class="fr-remove" data-remove-member="' + member.id + '" aria-label="Remove ' + escapeHTML(member.name) + '">×</button></div></th>' +
        '<td><input type="checkbox" data-member="' + member.id + '" data-field="excluded" aria-label="Exclude ' + escapeHTML(member.name) + ' from calculations"' + (member.excluded ? ' checked' : '') + '></td>' +
        '<td><select data-member="' + member.id + '" data-field="role" aria-label="Role for ' + escapeHTML(member.name) + '">' + roleOptions(member) + '</select></td>' +
        '<td class="fr-power" title="' + (powerNumber(member.power) ? powerNumber(member.power).toLocaleString('en-US') : 'Unknown') + '">' + powerLabel(member.power) + '</td>' +
        '<td>' + (isMax(member) ? '—' : '<select data-member="' + member.id + '" data-field="contribution" aria-label="Contribution for ' + escapeHTML(member.name) + '">' + contributionOptions(member) + '</select>') + '</td></tr>';
    }).join('');
    var rewardRows = state.rewards.map(function (reward) {
      var total = rewardTotal(reward), quantity = integer(reward.quantity);
      return '<tr><th scope="row"><input type="text" maxlength="80" value="' + escapeHTML(reward.name) + '" data-reward="' + reward.id + '" data-field="name" aria-label="Reward name"></th>' +
        '<td><input type="number" min="0" max="100000" value="' + quantity + '" data-reward="' + reward.id + '" data-field="quantity" aria-label="Available quantity for ' + escapeHTML(reward.name) + '"></td>' +
        '<td><input type="number" min="0" max="100000" value="' + integer(reward.cap) + '" data-reward="' + reward.id + '" data-field="cap" aria-label="Per-player limit for ' + escapeHTML(reward.name) + '"></td>' +
        '<td class="' + (total > quantity ? 'fr-bad' : '') + '"><strong>' + total + ' / ' + quantity + '</strong></td>' +
        '<td>' + (SITES.some(function (site) { return reward.id === site.id + '-chests' || reward.id === site.id + '-special'; }) ? '' : '<button type="button" class="fr-remove" data-remove-reward="' + reward.id + '" aria-label="Remove ' + escapeHTML(reward.name) + '">×</button>') + '</td></tr>';
    }).join('');
    var activeReward = state.rewards.find(function (reward) { return reward.id === state.activeRewardId; }) || state.rewards[0];
    if (activeReward) state.activeRewardId = activeReward.id;
    var rewardPicker = activeReward ? '<label>Reward to edit<select id="fr-active-reward">' + state.rewards.map(function (reward) {
      return '<option value="' + reward.id + '"' + (reward.id === activeReward.id ? ' selected' : '') + '>' + escapeHTML(reward.name) + '</option>';
    }).join('') + '</select></label>' : '';
    var allocationRows = activeReward ? '<div class="fr-alloc-card"><h4>' + escapeHTML(activeReward.name) + '<span>' + rewardTotal(activeReward) + ' / ' + integer(activeReward.quantity) + '</span></h4>' +
      (includedMembers().length ? '<div class="fr-alloc-grid">' + sortedMembers(includedMembers(), allocSort).map(function (member) {
        var value = assigned(activeReward, member), over = integer(activeReward.cap) && value > integer(activeReward.cap);
        return '<label class="' + (over ? 'fr-bad' : '') + '"><span>' + escapeHTML(member.name) + ' <em>' + roleLabel(member.role) + (powerNumber(member.power) ? ' · ' + powerLabel(member.power) : '') + '</em></span><input type="number" min="0" max="100000" value="' + value + '" data-cell-reward="' + activeReward.id + '" data-cell-member="' + member.id + '" aria-label="' + escapeHTML(activeReward.name + ' for ' + member.name) + '"></label>';
      }).join('') + '</div>' : '<p class="fr-empty">Add members to assign rewards.</p>') + '</div>' : '';
    var siteCards = SITES.map(function (site) {
      var selected = state.sites.indexOf(site.id) >= 0;
      var chests = site.id.charAt(0) === 'f' ? 40 : 100;
      return '<label class="fr-site' + (selected ? ' selected' : '') + '"><input type="checkbox" data-site="' + site.id + '"' + (selected ? ' checked' : '') + '><span><strong>' + site.label + '</strong><small>' + chests + ' chests + ' + site.amount + ' ' + (site.specialName || 'special rewards') + '</small></span></label>';
    }).join('');
    root.innerHTML = '<div class="fr-head"><div><h2>Fortress rewards</h2><p>Prepare an alliance distribution, then copy it for R4/R5 assignment in game.</p></div><span class="fr-local">Saved in this browser</span></div>' +
      '<div class="fr-layout"><div class="fr-main">' +
      '<section class="fr-card"><div class="fr-card-head"><h3>Current sites</h3><span>' + state.sites.length + ' selected</span></div><p>Select only the fortresses and strongholds your alliance currently controls. Their chests and special rewards are added below.</p><div class="fr-sites">' + siteCards + '</div><p class="fr-note">Special reward names can be edited in the reward pools.</p></section>' +
      '<section class="fr-card"><div class="fr-card-head"><h3>1. Members</h3><span>' + state.members.length + '</span></div><p>Members with the Max role receive the per-player maximum. Excluded members, including Ricky Lahey, are ignored. Paste one additional name per line.</p>' +
      '<div class="fr-add"><textarea id="fr-names" rows="3" placeholder="One member per line" aria-label="Member names"></textarea><button type="button" class="fr-primary" data-action="add-members">Add members</button></div>' +
      '<div class="fr-game"><button type="button" class="fr-secondary" data-action="game-sync">Update from game</button><span>Names, ranks (R1–R5) and power of FOX members, from whiteoutstats.com. Max members stay Max.</span></div>' +
      (gameMsg ? '<p class="fr-game-msg" role="status">' + escapeHTML(gameMsg) + '</p>' : '') +
      (goneMembers().length ? '<div class="fr-game"><button type="button" class="fr-secondary fr-danger" data-action="remove-gone">' + (goneArmed ? 'Tap again to remove ' + goneMembers().length + ' member' + (goneMembers().length === 1 ? '' : 's') : 'Remove the ' + goneMembers().length + ' member' + (goneMembers().length === 1 ? '' : 's') + ' not in FOX') + '</button><span>Deletes them and their rewards from this list. This cannot be undone.</span></div>' : '') +
      (state.members.length ? '<div class="fr-list-tools"><input id="fr-member-search" type="search" placeholder="Find member" aria-label="Find member">' + sortButtons('members', memberSort, 'Sort members') + '</div><div class="fr-scroll fr-members-scroll"><table><thead><tr><th>Member</th><th>Exclude</th><th>Role</th><th>Power</th><th>Contribution</th></tr></thead><tbody>' + memberRows + '</tbody></table></div>' : '<p class="fr-empty">No members yet.</p>') +
      '<p class="fr-note">Contribution rates each member’s engagement from 1 to 4. Max members do not need a rating.</p></section>' +
      '<section class="fr-card"><div class="fr-card-head"><h3>2. Reward pools</h3><span>' + state.rewards.length + '</span></div><p>Enter the in-game per-player maximum for each pool before giving Max members their full share.</p>' +
      '<div class="fr-add fr-add-reward"><input id="fr-reward-name" type="text" maxlength="80" placeholder="Reward name" aria-label="Reward name"><input id="fr-reward-quantity" type="number" min="1" max="100000" value="1" aria-label="Available quantity"><input id="fr-reward-cap" type="number" min="0" max="100000" value="0" aria-label="Per-player limit"><button type="button" class="fr-primary" data-action="add-reward">Add reward</button></div>' +
      (state.rewards.length ? '<div class="fr-scroll"><table><thead><tr><th>Reward</th><th>Available</th><th>Limit / player</th><th>Assigned</th><th></th></tr></thead><tbody>' + rewardRows + '</tbody></table></div>' : '<p class="fr-empty">No reward pools yet.</p>') + '</section>' +
      '<section class="fr-card"><div class="fr-card-head"><h3>3. Distribution</h3></div><div class="fr-controls">' + rewardPicker + sortButtons('alloc', allocSort, 'Sort players') + '<label>Show players with<select id="fr-show-count" aria-label="Show players with this reward count"></select></label><button type="button" class="fr-primary" data-action="propose"' + (!includedMembers().length || !state.rewards.length ? ' disabled' : '') + '>Distribute by contribution</button><span id="fr-filter-count" class="fr-filter-count" aria-live="polite"></span></div>' +
      '<p class="fr-note">Max members receive their per-player maximum first. Remaining rewards are weighted by each member’s contribution, within the per-player limits. This replaces current allocations; you can edit the numbers below.</p>' +
      (allocationRows || '<p class="fr-empty">Add members and reward pools to start.</p>') + '</section></div>' +
      '<aside class="fr-card fr-summary"><h3>Distribution summary</h3><div class="fr-numbers"><div><strong>' + s.allocated + '</strong><span>Assigned</span></div><div><strong>' + Math.max(0, s.available - s.allocated) + '</strong><span>Remaining</span></div></div>' +
      (s.issues.length ? '<div class="fr-issues" role="alert"><strong>Check allocations</strong><ul>' + s.issues.map(function (issue) { return '<li>' + escapeHTML(issue) + '</li>'; }).join('') + '</ul></div>' : '<p class="fr-ok">No limits exceeded.</p>') +
      '<button type="button" class="fr-primary" data-action="copy"' + (!state.rewards.length || !includedMembers().length || s.issues.length ? ' disabled' : '') + '>Copy distribution</button><button type="button" class="fr-secondary" data-action="csv"' + (!state.rewards.length || !includedMembers().length || s.issues.length ? ' disabled' : '') + '>Download CSV</button><p id="fr-message" role="status" aria-live="polite"></p><p class="fr-note">This draft stays in your browser. It does not send rewards in game.</p></aside></div>';
    var newSearch = root.querySelector('#fr-member-search');
    if (newSearch) { newSearch.value = searchText; onInput({ target: newSearch }); }
    var newList = root.querySelector('.fr-members-scroll');
    if (newList) newList.scrollTop = listScroll;
    applyAllocationFilter();
  }
  function applyAllocationFilter() {
    var select = root.querySelector('#fr-show-count');
    if (!select) return;
    var rows = [].slice.call(root.querySelectorAll('.fr-alloc-grid label'));
    var counts = {};
    rows.forEach(function (row) { counts[integer(row.querySelector('input').value)] = true; });
    if (shownCount !== '') counts[integer(shownCount)] = true;
    select.innerHTML = '<option value="">Show all</option>' + Object.keys(counts).map(Number).sort(function (a, b) { return a - b; }).map(function (count) {
      return '<option value="' + count + '">' + count + (count === 1 ? ' reward' : ' rewards') + '</option>';
    }).join('');
    select.value = shownCount;
    var shown = 0;
    rows.forEach(function (row) {
      row.hidden = shownCount !== '' && integer(row.querySelector('input').value) !== integer(shownCount);
      if (!row.hidden) shown++;
    });
    var counter = root.querySelector('#fr-filter-count');
    if (counter) counter.textContent = shown + ' / ' + rows.length + ' players shown';
  }
  function exportRows() {
    var rows = [];
    state.rewards.forEach(function (reward) {
      includedMembers().forEach(function (member) {
        var count = assigned(reward, member);
        if (count) rows.push({ rewardId: reward.id, reward: reward.name, member: member.name, count: count });
      });
    });
    return rows;
  }
  function ago(t) {
    var m = Math.round((Date.now() - Date.parse(t)) / 60000);
    return !(m >= 0) ? 'recently' : m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago';
  }
  /* "Update from game": the FOX roster that the wos-sync Edge Function copies from whiteoutstats.com
     (window.FOXGameData in app.js). Members are matched by player id (cid), then by name; missing ones are
     added; the in-game rank sets R1–R5 unless the member is Max; power follows the game. Nobody is removed:
     members no longer in FOX are listed so the user can exclude or remove them. */
  /* Names compared loosely, because the built-in list was typed from screenshots while the game sends the real,
     often decorated names: compatibility letters folded (ᴬᴰᴿᴵᴬᴺ → adrian), accents and symbols dropped, case
     ignored. A strong match (same player id, same name or same folded name) wins; otherwise one folded name
     containing the other (3+ letters), the closest power breaking ties. */
  /* Look-alike letters of decorated names (ΔĐŘɨΔŇ → adrian): Greek, Cyrillic, stroked letters, small capitals. */
  var FOLD = (function () { var o = {}; 'Δa δd Λa λa Αa αa Βb βb Εe εe Σe σo ςs Ηh ηn Ιi ιi Κk κk Μm μu Νn νv Οo οo Ρp ρp Τt τt Υy υu Χx χx Ωo ωw Πn πn Θo θo Φo φo Γr γy Ζz ζz Аa аa Вb вb Еe еe Кk кk Мm мm Нh нh Оo оo Рp рp Сc сc Тt тt Уy уy Хx хx Ьb ьb Яr яr Иn иn Дd дd Лl лl Цu цu Гr гr Шw шw Щw щw Пn пn Фo фo Эe эe Đd đd Ɨi ɨi Łl łl Øo øo Ħh ħh Ŧt ŧt Ƀb ƀb Ɍr ɍr Ƶz ƶz ßb Ææe æae Œoe œoe ıi ȷj Ɇe ɇe Ɏy ɏy Ðd ðd Þp þp Ɛe ɛe Ɔo ɔo ɑa ɡg ᴀa ʙb ᴄc ᴅd ᴇe ꜰf ғf ɢg ʜh ɪi ᴊj ᴋk ʟl ᴍm ɴn ᴏo ᴘp ʀr ꜱs ᴛt ᴜu ᴠv ᴡw ʏy ᴢz @a $s €e ¥y £l ¢c'.split(' ').forEach(function (t) { o[t.charAt(0)] = t.slice(1); }); return o; }());
  /* Members who changed their in-game name (old folded name → new one), confirmed by Adrian on 11 Nov 2026 and
     paired by power growth (Talie 367.6M → Glitter Menace 432.6M, SkyMnky 425.5M → Hercutease 502.0M). */
  var RENAMED = { talie: 'glittermenace', skymnky: 'hercutease' };
  function nameKey(value) {
    var key = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x00-\x7f]/g, function (c) { return FOLD[c] || ''; }).replace(/[@$]/g, function (c) { return FOLD[c]; })
      .toLowerCase().replace(/[^a-z0-9]/g, '');
    return RENAMED[key] || key;
  }
  function strongMatch(r, name) {
    var key = nameKey(name);
    return state.members.find(function (m) { return m.cid === r.chief_id; }) ||
      state.members.find(function (m) { return !m.cid && m.name.toLowerCase() === name.toLowerCase(); }) ||
      (key.length >= 3 ? state.members.find(function (m) { return !m.cid && nameKey(m.name) === key; }) : null);
  }
  function looseMatch(r, name) {
    var key = nameKey(name), power = Number(r.power) || 0;
    if (key.length < 3) return null;
    var found = state.members.filter(function (m) {
      var k = nameKey(m.name);
      return !m.cid && k.length >= 3 && (k.indexOf(key) >= 0 || key.indexOf(k) >= 0);
    });
    found.sort(function (a, b) { return Math.abs((a.power || 0) - power) - Math.abs((b.power || 0) - power); });
    return found[0] || null;
  }
  function goneMembers() { return state.members.filter(function (m) { return gameGone.indexOf(m.id) >= 0; }); }
  function removeGone() {
    var gone = goneMembers();
    if (!gone.length) return;
    if (!goneArmed) { goneArmed = setTimeout(function () { goneArmed = null; render(); }, 5000); render(); return; }
    clearTimeout(goneArmed); goneArmed = null;
    state.members = state.members.filter(function (m) { return gameGone.indexOf(m.id) < 0; });
    Object.keys(state.allocation).forEach(function (key) { gone.forEach(function (m) { delete state.allocation[key][m.id]; }); });
    gameGone = [];
    gameMsg = gone.length + ' member' + (gone.length === 1 ? '' : 's') + ' not in FOX removed: ' + gone.map(function (m) { return m.name; }).join(', ') + '.';
    save(); render();
  }
  function syncFromGame() {
    var store = window.FOXGameData;
    if (!store) { gameMsg = 'In-game data is not available here.'; render(); return; }
    gameMsg = 'Reading the FOX roster from the game…'; render();
    store.players().then(function (rows) {
      if (rows === undefined) { gameMsg = 'Sign in to read the FOX roster from the game.'; render(); return; }
      var fox = (rows || []).filter(function (r) { return r.alliance === 'FOX' && String(r.nick_name || '').trim(); });
      if (!fox.length) { gameMsg = 'No FOX roster yet: it appears once the whiteoutstats.com sync is running.'; render(); return; }
      var added = 0, roles = 0, renamed = 0, seen = {}, matched = {};
      /* Strong matches first for everyone, so a loose match never takes a member that has an exact one. */
      fox.forEach(function (r) {
        var member = strongMatch(r, String(r.nick_name).trim().slice(0, 60));
        if (member) { matched[r.chief_id] = member; member.cid = r.chief_id; }
      });
      fox.forEach(function (r) {
        var name = String(r.nick_name).trim().slice(0, 60);
        var member = matched[r.chief_id] || looseMatch(r, name);
        var role = r.alliance_rank >= 1 && r.alliance_rank <= 5 ? 'r' + r.alliance_rank : null;
        if (!member) { member = { id: id(), name: name, role: role || 'r1', power: 0, contribution: 1, excluded: false }; state.members.push(member); added++; }
        else if (role && !isMax(member) && member.role !== role) { member.role = role; roles++; }
        if (member.name !== name && seen[member.id] === undefined && member.name) renamed++;
        member.cid = r.chief_id;
        member.name = name;
        if (r.power != null) member.power = powerNumber(r.power);
        seen[member.id] = true;
      });
      /* Everyone the game roster did not match, excluded members included: "Remove" deletes them on request. */
      var gone = state.members.filter(function (m) { return !seen[m.id]; });
      gameGone = gone.map(function (m) { return m.id; });
      var latest = fox.map(function (r) { return r.roster_at; }).filter(Boolean).sort().pop();
      gameMsg = 'FOX roster from the game' + (latest ? ' (read ' + ago(latest) + ')' : '') + ': ' + fox.length + ' members, ' + added + ' added, ' + renamed + ' renamed to their in-game name, ' + roles + ' role' + (roles === 1 ? '' : 's') + ' updated.' +
        (gone.length ? ' Not in FOX in game: ' + gone.map(function (m) { return m.name; }).join(', ') + '.' : '');
      save(); render();
    }, function (e) { gameMsg = 'In-game data unavailable: ' + (e && e.message || 'error'); render(); });
  }
  function message(value) { var el = root.querySelector('#fr-message'); if (el) el.textContent = value; }
  function onInput(event) {
    if (event.target.id !== 'fr-member-search') return;
    var query = event.target.value.trim().toLowerCase();
    root.querySelectorAll('tr[data-member-name]').forEach(function (row) {
      row.hidden = row.dataset.memberName.indexOf(query) < 0;
    });
  }
  function onClick(event) {
    var button = event.target.closest('button');
    if (!button || !root.contains(button)) return;
    if (button.dataset.sortMembers) state.memberSort = sortMode(button.dataset.sortMembers, 'role');
    else if (button.dataset.sortAlloc) state.allocSort = sortMode(button.dataset.sortAlloc, 'name');
    else if (button.dataset.removeMember) {
      var memberId = button.dataset.removeMember;
      state.members = state.members.filter(function (m) { return m.id !== memberId; });
      Object.keys(state.allocation).forEach(function (key) { delete state.allocation[key][memberId]; });
    } else if (button.dataset.removeReward) {
      state.rewards = state.rewards.filter(function (r) { return r.id !== button.dataset.removeReward; });
      delete state.allocation[button.dataset.removeReward];
    } else if (button.dataset.action === 'add-members') {
      var raw = root.querySelector('#fr-names').value;
      raw.split(/\r?\n/).map(function (name) { return name.trim().slice(0, 60); }).filter(Boolean).forEach(function (name) {
        if (!state.members.some(function (m) { return m.name.toLowerCase() === name.toLowerCase(); }))
          state.members.push({ id: id(), name: name, role: 'r3', power: 0, contribution: 1, excluded: false });
      });
    } else if (button.dataset.action === 'add-reward') {
      var name = root.querySelector('#fr-reward-name').value.trim().slice(0, 80);
      if (!name) { root.querySelector('#fr-reward-name').focus(); return; }
      state.rewards.push({ id: id(), name: name, quantity: Math.max(1, integer(root.querySelector('#fr-reward-quantity').value)), cap: integer(root.querySelector('#fr-reward-cap').value) });
    } else if (button.dataset.action === 'remove-gone') {
      removeGone();
      return;
    } else if (button.dataset.action === 'game-sync') {
      syncFromGame();
      return;
    } else if (button.dataset.action === 'propose') {
      propose();
      return;
    } else if (button.dataset.action === 'copy' || button.dataset.action === 'csv') {
      if (stats().issues.length) return;
      var rows = exportRows();
      if (button.dataset.action === 'copy') {
        var lines = ['Fortress rewards distribution'];
        state.rewards.forEach(function (reward) {
          lines.push('', reward.name + ' (' + rewardTotal(reward) + '/' + integer(reward.quantity) + ')');
          rows.filter(function (r) { return r.rewardId === reward.id; }).forEach(function (r) { lines.push(r.member + ' — ' + r.count); });
        });
        if (navigator.clipboard && navigator.clipboard.writeText)
          navigator.clipboard.writeText(lines.join('\n')).then(function () { message('Distribution copied.'); }, function () { message('Copy failed. Use Download CSV.'); });
        else message('Clipboard unavailable. Use Download CSV.');
      } else {
        var csv = 'Reward,Member,Quantity\r\n' + rows.map(function (row) {
          return [row.reward, row.member, row.count].map(function (value) {
            var cell = String(value);
            if (/^[\s]*[=+@-]/.test(cell)) cell = "'" + cell;
            return '"' + cell.replace(/"/g, '""') + '"';
          }).join(',');
        }).join('\r\n');
        var url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
        var link = document.createElement('a'); link.href = url; link.download = 'fortress-rewards.csv'; link.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }
      return;
    } else return;
    save(); render();
  }
  function onChange(event) {
    var target = event.target, member, reward;
    if (target.id === 'fr-show-count') { shownCount = target.value; applyAllocationFilter(); return; }
    if (target.dataset.site) {
      var site = SITES.find(function (item) { return item.id === target.dataset.site; });
      if (!site) return;
      if (target.checked) {
        if (state.sites.indexOf(site.id) < 0) state.sites.push(site.id);
        var chestId = site.id + '-chests', rewardId = site.id + '-special';
        if (!state.rewards.some(function (r) { return r.id === chestId; }))
          state.rewards.push({ id: chestId, name: site.label + ' chests', quantity: site.id.charAt(0) === 'f' ? 40 : 100, cap: site.id.charAt(0) === 'f' ? 1 : 2 });
        if (!state.rewards.some(function (r) { return r.id === rewardId; }))
          state.rewards.push({ id: rewardId, name: site.label + ' ' + (site.specialName || 'special reward'), quantity: site.amount, cap: site.specialCap || 0 });
      } else {
        state.sites = state.sites.filter(function (value) { return value !== site.id; });
        state.rewards = state.rewards.filter(function (r) { return r.id !== site.id + '-chests' && r.id !== site.id + '-special'; });
        delete state.allocation[site.id + '-chests'];
        delete state.allocation[site.id + '-special'];
      }
    } else if (target.id === 'fr-active-reward') state.activeRewardId = target.value;
    else if (target.dataset.member) {
      member = state.members.find(function (m) { return m.id === target.dataset.member; });
      if (member) {
        if (target.dataset.field === 'name') member.name = target.value.trim().slice(0, 60) || member.name;
        else if (target.dataset.field === 'role') member.role = normRole(target.value);
        else if (target.dataset.field === 'contribution' && !isMax(member)) member.contribution = Math.min(4, Math.max(1, integer(target.value)));
        else if (target.dataset.field === 'power') member.power = powerNumber(target.value);
        else if (target.dataset.field === 'excluded') {
          member.excluded = target.checked;
          if (member.excluded) Object.keys(state.allocation).forEach(function (key) { delete state.allocation[key][member.id]; });
        }
      }
    } else if (target.dataset.reward) {
      reward = state.rewards.find(function (r) { return r.id === target.dataset.reward; });
      if (reward) reward[target.dataset.field] = target.dataset.field === 'name' ? (target.value.trim().slice(0, 80) || reward.name) : integer(target.value);
    } else if (target.dataset.cellReward && target.dataset.cellMember) {
      reward = state.rewards.find(function (r) { return r.id === target.dataset.cellReward; });
      member = state.members.find(function (m) { return m.id === target.dataset.cellMember; });
      if (reward && member && !member.excluded) setAssigned(reward, member, target.value);
    } else return;
    save(); render();
  }
  window.FOXFortress = { mount: function (host, accountId) {
    if (!host) return;
    var key = 'fox-fortress-rewards-' + (accountId || 'guest');
    if (root === host && storageKey === key) return;
    if (root) { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); root.removeEventListener('input', onInput); }
    root = host; storageKey = key; load(); render();
    root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput);
  } };
}());
