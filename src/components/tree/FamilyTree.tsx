"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Member, Spouse } from "@/types";

export interface MotherExtraUnion {
  union: Spouse;
  partner: Member;
  children?: Member[];
}

export interface OwnUnionData {
  union: Spouse;
  partner: Member;
}

export interface AncestorInfo {
  father: Member | null;
  mother: Member | null;
  parentUnion: Spouse | null;
}

export interface TreeData {
  person: Member;
  father: Member | null;
  mother: Member | null;
  siblings: Member[];
  parentUnion: Spouse | null;
  motherOtherUnions?: MotherExtraUnion[];
  ownUnions?: OwnUnionData[];
}

interface FamilyTreeProps {
  data: TreeData;
  /** parentId → ses propres parents (quand le nœud est "développé") */
  expandedAncestors: Record<string, AncestorInfo>;
  /** Clic sur un nœud parent → développer/réduire */
  onToggleExpand: (m: Member) => void;
  /** Clic sur fratrie / conjoint / grand-parent → naviguer */
  onSelectMember: (m: Member) => void;
  onSelectUnion: (u: Spouse) => void;
}

// ── Constantes de layout ──────────────────────────────────────────
const W         = 1300;
const H_BASE    = 580;   // hauteur sans expansion
const GEN_H     = 180;   // hauteur d'une génération supplémentaire
const GP_Y_BASE = 75;    // Y des grands-parents quand expansé
const R         = 42;
const UR        = 20;
const PARENT_Y  = 140;
const DROP_Y    = 270;
const CHILD_Y   = 430;
const MID_X     = 520;
const PARENT_GAP = 360;
const CHILD_GAP  = 160;
const EXTRA_GAP  = 240;
const OWN_GAP    = 220;
const GP_HALF    = 95;   // demi-écart horizontal entre 2 grands-parents

const FATHER_X = MID_X - PARENT_GAP / 2;
const MOTHER_X = MID_X + PARENT_GAP / 2;

// ── Couleurs ──────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  father:       "#1d4ed8",
  mother:       "#db2777",
  self:         "#059669",
  sibling:      "#7c3aed",
  extraPartner: "#f97316",
  halfSibling:  "#ea580c",
  spouse:       "#be185d",
  grandparent:      "#475569",
  greatgrandparent: "#94a3b8",
};

const ROLE_LABEL: Record<string, string> = {
  father:       "PÈRE",
  mother:       "MÈRE",
  self:         "MOI",
  sibling:      "FRATRIE",
  extraPartner: "PARTENAIRE",
  halfSibling:  "DEMI-FRATRIE",
  spouse:       "CONJOINT·E",
  grandparent:      "GRAND-PARENT",
  greatgrandparent: "ARR.-GRAND-PARENT",
};

type NodeData = Member & { role: string; nx: number; ny: number };

// ── Composant ─────────────────────────────────────────────────────
export function FamilyTree({
  data,
  expandedAncestors,
  onToggleExpand,
  onSelectMember,
  onSelectUnion,
}: FamilyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { person, father, mother, siblings, parentUnion } = data;
  const motherOtherUnions = data.motherOtherUnions ?? [];
  const ownUnions         = data.ownUnions         ?? [];

  // ── Niveaux d'expansion (0 = aucun, 1 = GP visibles, 2 = AGP visibles) ──
  const parentIds  = new Set([father?.id, mother?.id, ...motherOtherUnions.map(u => u.partner.id)].filter(Boolean) as string[]);
  const level1Keys = Object.keys(expandedAncestors).filter(id => parentIds.has(id));
  const gpIds      = new Set(level1Keys.flatMap(pid => [expandedAncestors[pid].father?.id, expandedAncestors[pid].mother?.id].filter(Boolean) as string[]));
  const level2Keys = Object.keys(expandedAncestors).filter(id => gpIds.has(id));
  const expLevel   = level2Keys.length > 0 ? 2 : level1Keys.length > 0 ? 1 : 0;

  // ── Positions Y dynamiques ────────────────────────────────────
  const svgH   = H_BASE + expLevel * GEN_H;
  const pY     = expLevel === 0 ? PARENT_Y : GP_Y_BASE + expLevel * GEN_H;
  const dropY  = pY + (DROP_Y - PARENT_Y);
  const childY = pY + (CHILD_Y - PARENT_Y);
  const gpY    = expLevel >= 1 ? GP_Y_BASE + (expLevel - 1) * GEN_H : GP_Y_BASE;
  const ggpY   = GP_Y_BASE;

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const _pY     = pY;
    const _dropY  = dropY;
    const _childY = childY;
    const _gpY    = gpY;
    const _ggpY   = ggpY;

    const isSep      = !!parentUnion?.separation_date;
    const unionColor = isSep ? "#94a3b8" : "#ec4899";
    const g = svg.append("g");

    // ── Enfants de l'union principale ────────────────────────────
    const visibleMain: (Member & { role: string })[] = [
      ...siblings.slice(0, Math.ceil(siblings.length / 2)).map(s => ({ ...s, role: "sibling" })),
      { ...person, role: "self" },
      ...siblings.slice(Math.ceil(siblings.length / 2)).map(s => ({ ...s, role: "sibling" })),
    ];
    const N      = visibleMain.length;
    const startX = MID_X - ((N - 1) * CHILD_GAP) / 2;
    const mainChildNodes: NodeData[] = visibleMain.map((c, i) => ({
      ...c, nx: startX + i * CHILD_GAP, ny: _childY,
    }));

    const selfNode = mainChildNodes.find(c => c.id === person.id);
    const selfNx   = selfNode?.nx ?? MID_X;

    // ── Parents ───────────────────────────────────────────────────
    const parentNodes: NodeData[] = [];
    if (father) parentNodes.push({ ...father, role: "father", nx: FATHER_X, ny: _pY });
    if (mother) parentNodes.push({ ...mother, role: "mother", nx: MOTHER_X, ny: _pY });

    // ── Partenaires supplémentaires de la mère ────────────────────
    const extraPartnerNodes: NodeData[] = [];
    const extraChildGroups: { nodes: NodeData[]; unionX: number }[] = [];
    motherOtherUnions.forEach(({ partner, children = [] }, i) => {
      const partnerX = MOTHER_X + (i + 1) * EXTRA_GAP;
      const unionX   = MOTHER_X + (i + 0.5) * EXTRA_GAP;
      extraPartnerNodes.push({ ...partner, role: "extraPartner", nx: partnerX, ny: _pY });
      if (children.length > 0) {
        const hs = children.map((c, j) => ({
          ...c, role: "halfSibling",
          nx: unionX - ((children.length - 1) * CHILD_GAP) / 2 + j * CHILD_GAP,
          ny: _childY,
        })) as NodeData[];
        extraChildGroups.push({ nodes: hs, unionX });
      }
    });

    // ── Conjoints de la personne : gauche ← MOI → droite ─────────
    const leftCount   = Math.floor(ownUnions.length / 2);
    const leftUnions  = ownUnions.slice(0, leftCount);
    const rightUnions = ownUnions.slice(leftCount);
    const leftSpouseNodes: NodeData[]  = leftUnions.map(({ partner }, i) => ({
      ...partner, role: "spouse", nx: selfNx - (leftCount - i) * OWN_GAP, ny: _childY,
    }));
    const rightSpouseNodes: NodeData[] = rightUnions.map(({ partner }, i) => ({
      ...partner, role: "spouse", nx: selfNx + (i + 1) * OWN_GAP, ny: _childY,
    }));
    const spouseNodes = [...leftSpouseNodes, ...rightSpouseNodes];

    // ── Grands-parents (expansion) ────────────────────────────────
    const parentXMap: Record<string, number> = {};
    if (father) parentXMap[father.id] = FATHER_X;
    if (mother) parentXMap[mother.id] = MOTHER_X;
    motherOtherUnions.forEach(({ partner }, i) => {
      parentXMap[partner.id] = MOTHER_X + (i + 1) * EXTRA_GAP;
    });

    const grandparentNodes: NodeData[] = [];
    Object.entries(expandedAncestors).forEach(([pid, anc]) => {
      const parentX = parentXMap[pid];
      if (parentX === undefined) return;
      const bothGP = !!anc.father && !!anc.mother;
      if (anc.father) grandparentNodes.push({
        ...anc.father, role: "grandparent",
        nx: bothGP ? parentX - GP_HALF : parentX, ny: _gpY,
      });
      if (anc.mother) grandparentNodes.push({
        ...anc.mother, role: "grandparent",
        nx: bothGP ? parentX + GP_HALF : parentX, ny: _gpY,
      });
    });

    // ── Arrière-grands-parents (niveau 2) ─────────────────────────
    const gpXMap: Record<string, number> = {};
    grandparentNodes.forEach(n => { gpXMap[n.id] = n.nx; });

    const greatGrandparentNodes: NodeData[] = [];
    Object.entries(expandedAncestors).forEach(([gpid, anc]) => {
      const gpX = gpXMap[gpid];
      if (gpX === undefined) return;
      const bothGGP = !!anc.father && !!anc.mother;
      if (anc.father) greatGrandparentNodes.push({
        ...anc.father, role: "greatgrandparent",
        nx: bothGGP ? gpX - GP_HALF : gpX, ny: _ggpY,
      });
      if (anc.mother) greatGrandparentNodes.push({
        ...anc.mother, role: "greatgrandparent",
        nx: bothGGP ? gpX + GP_HALF : gpX, ny: _ggpY,
      });
    });

    const allNodes: NodeData[] = [
      ...parentNodes,
      ...mainChildNodes,
      ...extraPartnerNodes,
      ...extraChildGroups.flatMap(eg => eg.nodes),
      ...spouseNodes,
      ...grandparentNodes,
      ...greatGrandparentNodes,
    ];

    const hasBothParents = father && mother;

    // ── Lignes grands-parents ─────────────────────────────────────
    Object.entries(expandedAncestors).forEach(([pid, anc]) => {
      const parentX = parentXMap[pid];
      if (parentX === undefined) return;
      const bothGP = !!anc.father && !!anc.mother;

      if (bothGP) {
        // Lignes horizontales vers le losange
        g.append("line")
          .attr("x1", parentX - GP_HALF).attr("y1", _gpY)
          .attr("x2", parentX - UR).attr("y2", _gpY)
          .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
        g.append("line")
          .attr("x1", parentX + UR).attr("y1", _gpY)
          .attr("x2", parentX + GP_HALF).attr("y2", _gpY)
          .attr("stroke", "#cbd5e1").attr("stroke-width", 2);

        // Losange union grands-parents
        if (anc.parentUnion) {
          drawDiamond(svg, parentX, _gpY,
            anc.parentUnion.separation_date ? "✗" : "♥",
            anc.parentUnion.separation_date ? "#94a3b8" : "#ec4899",
            anc.parentUnion, onSelectUnion);
        } else {
          // Pas d'union connue : petit cercle de connexion
          svg.append("circle")
            .attr("cx", parentX).attr("cy", _gpY)
            .attr("r", 6).attr("fill", "#cbd5e1");
        }

        // Verticale losange → parent
        g.append("line")
          .attr("x1", parentX).attr("y1", _gpY + (anc.parentUnion ? UR : 6))
          .attr("x2", parentX).attr("y2", _pY - R)
          .attr("stroke", "#cbd5e1").attr("stroke-width", 2);

      } else {
        // Un seul grand-parent → ligne diagonale directe
        const gpNode = grandparentNodes.find(n =>
          (anc.father && n.id === anc.father.id) ||
          (anc.mother && n.id === anc.mother.id)
        );
        if (gpNode) {
          g.append("line")
            .attr("x1", gpNode.nx).attr("y1", _gpY + R)
            .attr("x2", parentX).attr("y2", _pY - R)
            .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
        }
      }
    });

    // ── Lignes arrière-grands-parents → grands-parents ───────────
    Object.entries(expandedAncestors).forEach(([gpid, anc]) => {
      const gpX = gpXMap[gpid];
      if (gpX === undefined) return;
      const bothGGP = !!anc.father && !!anc.mother;

      if (bothGGP) {
        g.append("line")
          .attr("x1", gpX - GP_HALF).attr("y1", _ggpY)
          .attr("x2", gpX - UR).attr("y2", _ggpY)
          .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
        g.append("line")
          .attr("x1", gpX + UR).attr("y1", _ggpY)
          .attr("x2", gpX + GP_HALF).attr("y2", _ggpY)
          .attr("stroke", "#cbd5e1").attr("stroke-width", 2);

        if (anc.parentUnion) {
          drawDiamond(svg, gpX, _ggpY,
            anc.parentUnion.separation_date ? "✗" : "♥",
            anc.parentUnion.separation_date ? "#94a3b8" : "#ec4899",
            anc.parentUnion, onSelectUnion);
        } else {
          svg.append("circle").attr("cx", gpX).attr("cy", _ggpY).attr("r", 6).attr("fill", "#cbd5e1");
        }

        g.append("line")
          .attr("x1", gpX).attr("y1", _ggpY + (anc.parentUnion ? UR : 6))
          .attr("x2", gpX).attr("y2", _gpY - R)
          .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      } else {
        const ggpNode = greatGrandparentNodes.find(n =>
          (anc.father && n.id === anc.father.id) ||
          (anc.mother && n.id === anc.mother.id)
        );
        if (ggpNode) {
          g.append("line")
            .attr("x1", ggpNode.nx).attr("y1", _ggpY + R)
            .attr("x2", gpX).attr("y2", _gpY - R)
            .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
        }
      }
    });

    // ── Lignes union principale ────────────────────────────────────
    if (hasBothParents) {
      g.append("line")
        .attr("x1", FATHER_X).attr("y1", _pY)
        .attr("x2", MID_X - UR).attr("y2", _pY)
        .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      g.append("line")
        .attr("x1", MID_X + UR).attr("y1", _pY)
        .attr("x2", MOTHER_X).attr("y2", _pY)
        .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      g.append("line")
        .attr("x1", MID_X).attr("y1", _pY + UR)
        .attr("x2", MID_X).attr("y2", _dropY)
        .attr("stroke", isSep ? "#cbd5e1" : "#fda4af")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", isSep ? "6,4" : "none");
    } else if (father || mother) {
      const px = father ? FATHER_X : MOTHER_X;
      g.append("line")
        .attr("x1", px).attr("y1", _pY)
        .attr("x2", selfNx).attr("y2", _childY - R)
        .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
    }

    // Barre + verticales enfants principaux
    if (hasBothParents && N > 0) {
      if (N > 1) {
        g.append("line")
          .attr("x1", mainChildNodes[0].nx).attr("y1", _dropY)
          .attr("x2", mainChildNodes[N - 1].nx).attr("y2", _dropY)
          .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
        mainChildNodes.forEach(child => {
          g.append("line")
            .attr("x1", child.nx).attr("y1", _dropY)
            .attr("x2", child.nx).attr("y2", child.ny - R)
            .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
        });
      } else {
        g.append("line")
          .attr("x1", MID_X).attr("y1", _dropY)
          .attr("x2", mainChildNodes[0].nx).attr("y2", mainChildNodes[0].ny - R)
          .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      }
    }

    // ── Unions supplémentaires de la mère ─────────────────────────
    motherOtherUnions.forEach(({ union }, i) => {
      const prevX    = MOTHER_X + i * EXTRA_GAP;
      const unionX   = MOTHER_X + (i + 0.5) * EXTRA_GAP;
      const partnerX = MOTHER_X + (i + 1) * EXTRA_GAP;
      g.append("line")
        .attr("x1", prevX).attr("y1", _pY)
        .attr("x2", unionX - UR).attr("y2", _pY)
        .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      g.append("line")
        .attr("x1", unionX + UR).attr("y1", _pY)
        .attr("x2", partnerX).attr("y2", _pY)
        .attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      drawDiamond(svg, unionX, _pY,
        union.separation_date ? "✗" : "♥",
        union.separation_date ? "#94a3b8" : "#ec4899",
        union, onSelectUnion);
    });

    // Demi-frères sous leurs losanges
    extraChildGroups.forEach(({ nodes: hs, unionX }) => {
      g.append("line")
        .attr("x1", unionX).attr("y1", _pY + UR)
        .attr("x2", unionX).attr("y2", _dropY)
        .attr("stroke", "#fed7aa").attr("stroke-width", 2);
      if (hs.length > 1) {
        g.append("line")
          .attr("x1", hs[0].nx).attr("y1", _dropY)
          .attr("x2", hs[hs.length - 1].nx).attr("y2", _dropY)
          .attr("stroke", "#fed7aa").attr("stroke-width", 2);
      }
      hs.forEach(child => {
        g.append("line")
          .attr("x1", child.nx).attr("y1", _dropY)
          .attr("x2", child.nx).attr("y2", child.ny - R)
          .attr("stroke", "#fed7aa").attr("stroke-width", 2);
      });
    });

    // ── Propres unions (gauche ← MOI → droite) ───────────────────
    leftUnions.forEach(({ union }, i) => {
      const spouseNx  = leftSpouseNodes[i].nx;
      const ownUnionX = (spouseNx + selfNx) / 2;
      const c = union.separation_date ? "#94a3b8" : "#be185d";
      g.append("line").attr("x1", spouseNx + R).attr("y1", _childY).attr("x2", ownUnionX - UR).attr("y2", _childY).attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      g.append("line").attr("x1", ownUnionX + UR).attr("y1", _childY).attr("x2", selfNx - R).attr("y2", _childY).attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      drawDiamond(svg, ownUnionX, _childY, union.separation_date ? "✗" : "♥", c, union, onSelectUnion);
    });
    rightUnions.forEach(({ union }, i) => {
      const spouseNx  = rightSpouseNodes[i].nx;
      const ownUnionX = (selfNx + spouseNx) / 2;
      const c = union.separation_date ? "#94a3b8" : "#be185d";
      g.append("line").attr("x1", selfNx + R).attr("y1", _childY).attr("x2", ownUnionX - UR).attr("y2", _childY).attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      g.append("line").attr("x1", ownUnionX + UR).attr("y1", _childY).attr("x2", spouseNx - R).attr("y2", _childY).attr("stroke", "#cbd5e1").attr("stroke-width", 2);
      drawDiamond(svg, ownUnionX, _childY, union.separation_date ? "✗" : "♥", c, union, onSelectUnion);
    });

    // ── Losange union principale (haut) ───────────────────────────
    if (hasBothParents) {
      const lbl = isSep
        ? (parentUnion?.separation_date ? `Sep. ${new Date(parentUnion.separation_date).getFullYear()}` : "Séparé")
        : (parentUnion?.union_date      ? `Uni. ${new Date(parentUnion.union_date).getFullYear()}`      : "Ensemble");
      const uG = svg.append("g")
        .attr("transform", `translate(${MID_X},${_pY})`)
        .style("cursor", parentUnion ? "pointer" : "default");
      uG.append("rect").attr("width", UR * 2).attr("height", UR * 2).attr("x", -UR).attr("y", -UR).attr("transform", "rotate(45)").attr("fill", unionColor).attr("stroke", "white").attr("stroke-width", 2.5).attr("rx", 2);
      uG.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("fill", "white").attr("font-size", "14px").attr("pointer-events", "none").text(isSep ? "✗" : "♥");
      uG.append("text").attr("text-anchor", "middle").attr("y", UR + 14).attr("fill", unionColor).attr("font-size", "10px").attr("font-weight", "600").attr("pointer-events", "none").text(lbl);
      uG.on("mouseenter", function () { d3.select(this).select("rect").transition().duration(120).attr("transform", "rotate(45) scale(1.15)"); })
        .on("mouseleave", function () { d3.select(this).select("rect").transition().duration(120).attr("transform", "rotate(45) scale(1)"); });
      if (parentUnion) uG.on("click", e => { e.stopPropagation(); onSelectUnion(parentUnion); });
    }

    // ── Nœuds personnes ───────────────────────────────────────────
    const EXPAND_ROLES = new Set(["father", "mother", "extraPartner", "grandparent"]);

    const nodeG = svg.selectAll<SVGGElement, NodeData>(".node")
      .data(allNodes, d => d.id)
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.nx},${d.ny})`)
      .style("cursor", d => d.role === "self" ? "default" : "pointer");

    // Anneau pointillé mère
    if (mother) {
      nodeG.filter(d => d.id === mother.id)
        .append("circle")
        .attr("r", R + 8).attr("fill", "none").attr("stroke", ROLE_COLOR.mother)
        .attr("stroke-width", 2).attr("stroke-dasharray", "6,4").attr("opacity", 0.4);
    }

    nodeG.append("circle")
      .attr("r", R)
      .attr("fill", d => d.death_date ? "#94a3b8" : (ROLE_COLOR[d.role] ?? "#64748b"))
      .attr("stroke", d => d.death_date ? "#64748b" : "white")
      .attr("stroke-width", 3)
      .attr("stroke-dasharray", d => d.death_date ? "6,3" : "none");

    nodeG.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("fill", "white").attr("font-size", "15px").attr("font-weight", "bold").attr("pointer-events", "none").text(d => d.death_date ? `† ${d.first_name[0]}${d.last_name[0]}` : `${d.first_name[0]}${d.last_name[0]}`);
    nodeG.append("text").attr("text-anchor", "middle").attr("y", R + 18).attr("fill", "#1e293b").attr("font-size", "13px").attr("font-weight", "600").attr("pointer-events", "none").text(d => d.first_name);
    nodeG.append("text").attr("text-anchor", "middle").attr("y", R + 33).attr("fill", "#64748b").attr("font-size", "12px").attr("pointer-events", "none").text(d => d.last_name.toUpperCase());
    nodeG.append("text").attr("text-anchor", "middle").attr("y", -(R + 12)).attr("fill", d => ROLE_COLOR[d.role] ?? "#64748b").attr("font-size", "10px").attr("font-weight", "700").attr("letter-spacing", "0.08em").attr("pointer-events", "none").text(d => ROLE_LABEL[d.role] ?? "");
    nodeG.filter(d => !!d.birth_date).append("text").attr("text-anchor", "middle").attr("y", R + 48).attr("fill", "#94a3b8").attr("font-size", "10px").attr("pointer-events", "none").text(d => d.birth_date ? new Date(d.birth_date).getFullYear().toString() : "");

    // Hint texte selon le rôle
    // Parents → développer / réduire
    nodeG.filter(d => EXPAND_ROLES.has(d.role))
      .append("text")
      .attr("text-anchor", "middle").attr("y", -(R + 24))
      .attr("fill", d => ROLE_COLOR[d.role] ?? "#64748b")
      .attr("font-size", "9px").attr("pointer-events", "none")
      .text(d => expandedAncestors[d.id] ? "▲ réduire" : "▼ développer");

    // Autres navigables → voir l'arbre
    nodeG.filter(d => !EXPAND_ROLES.has(d.role) && d.role !== "self")
      .append("text")
      .attr("text-anchor", "middle").attr("y", -(R + 24))
      .attr("fill", d => ROLE_COLOR[d.role] ?? "#64748b")
      .attr("font-size", "9px").attr("pointer-events", "none")
      .text("▶ naviguer");

    // ── Interactions ──────────────────────────────────────────────
    // Parents → toggle expansion
    nodeG.filter(d => EXPAND_ROLES.has(d.role))
      .on("click", (e, d) => { e.stopPropagation(); onToggleExpand(d as Member); });

    // Autres non-self → naviguer
    nodeG.filter(d => !EXPAND_ROLES.has(d.role) && d.role !== "self")
      .on("click", (e, d) => { e.stopPropagation(); onSelectMember(d as Member); });

    // Self → éditer
    nodeG.filter(d => d.role === "self")
      .on("click", (e, d) => { e.stopPropagation(); onSelectMember(d as Member); });

    // Hover (sauf self)
    nodeG.filter(d => d.role !== "self")
      .on("mouseenter", function () { d3.select(this).select("circle").transition().duration(130).attr("r", R + 4); })
      .on("mouseleave", function () { d3.select(this).select("circle").transition().duration(130).attr("r", R); });

  }, [data, expandedAncestors, onToggleExpand, onSelectMember, onSelectUnion,
      father, mother, person, siblings, parentUnion, motherOtherUnions, ownUnions,
      pY, dropY, childY, gpY, ggpY, expLevel]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${svgH}`}
      className="w-full"
      style={{ minWidth: 380 }}
    />
  );
}

// ── Losange réutilisable ──────────────────────────────────────────
function drawDiamond(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  x: number, y: number,
  icon: string, color: string,
  union: Spouse,
  onSelectUnion: (u: Spouse) => void,
) {
  const ownSep = !!union.separation_date;
  const label  = ownSep
    ? (union.separation_date ? `Sep. ${new Date(union.separation_date).getFullYear()}` : "Séparé")
    : (union.union_date      ? `Uni. ${new Date(union.union_date).getFullYear()}`      : "Ensemble");
  const UR = 20;

  const dG = svg.append("g").attr("transform", `translate(${x},${y})`).style("cursor", "pointer");
  dG.append("rect").attr("width", UR * 2).attr("height", UR * 2).attr("x", -UR).attr("y", -UR).attr("transform", "rotate(45)").attr("fill", color).attr("stroke", "white").attr("stroke-width", 2.5).attr("rx", 2);
  dG.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("fill", "white").attr("font-size", "14px").attr("pointer-events", "none").text(icon);
  dG.append("text").attr("text-anchor", "middle").attr("y", UR + 14).attr("fill", color).attr("font-size", "10px").attr("font-weight", "600").attr("pointer-events", "none").text(label);
  dG.on("mouseenter", function () { d3.select(this).select("rect").transition().duration(120).attr("transform", "rotate(45) scale(1.15)"); })
    .on("mouseleave", function () { d3.select(this).select("rect").transition().duration(120).attr("transform", "rotate(45) scale(1)"); })
    .on("click", e => { e.stopPropagation(); onSelectUnion(union); });
}
