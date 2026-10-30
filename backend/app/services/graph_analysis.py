import networkx as nx
from datetime import datetime
import numpy as np
from typing import List, Dict, Set, Tuple, Any
from app.models.infrastructure import InfrastructureComponent, ComponentStatus

class GraphAnalysis:
    """
    Class for analyzing infrastructure components using graph algorithms
    """
    
    @staticmethod
    def build_graph(components: Dict[str, InfrastructureComponent]) -> nx.DiGraph:
        """
        Build a directed graph from infrastructure components
        
        Args:
            components: Dictionary of infrastructure components
            
        Returns:
            nx.DiGraph: Directed graph representation of infrastructure
        """
        G = nx.DiGraph()
        
        # Add nodes
        for component_id, component in components.items():
            G.add_node(
                component_id,
                name=component.name,
                component_type=component.component_type,
                status=component.status,
                metadata=component.metadata
            )
        
        # Add edges (dependencies)
        for component_id, component in components.items():
            for dependency_id in component.dependencies:
                if dependency_id in components:
                    G.add_edge(component_id, dependency_id)
        
        return G
    
    @staticmethod
    def bfs_impact_analysis(
        components: Dict[str, InfrastructureComponent],
        source_id: str
    ) -> Dict[str, Any]:
        """
        Perform impact analysis using Breadth-First Search to find affected components
        
        Args:
            components: Dictionary of infrastructure components
            source_id: ID of the source component
            
        Returns:
            Dict: Analysis result with affected components and impact score
        """
        if source_id not in components:
            return {
                "source_component": source_id,
                "affected_components": [],
                "failure_domains": [],
                "impact_score": 0.0,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        # Build graph
        G = GraphAnalysis.build_graph(components)
        
        # Edges point from dependents to dependencies. Reversing the graph
        # allows one BFS from the failed dependency to all affected services.
        # This is O(V + E), rather than running a path search for every node.
        reversed_graph = G.reverse(copy=False)
        affected_components = set(nx.descendants(reversed_graph, source_id))
        affected_components.add(source_id)
        
        # Calculate impact score based on:
        # 1. Number of affected components relative to total
        # 2. Criticality of affected components
        # 3. Depth of dependency chains
        
        total_components = len(components)
        affected_ratio = len(affected_components) / total_components if total_components > 0 else 0
        
        # Calculate criticality score (0-1) based on component status
        criticality_score = 0.0
        for comp_id in affected_components:
            if comp_id in components:
                status = components[comp_id].status
                if status == ComponentStatus.CRITICAL:
                    criticality_score += 1.0
                elif status == ComponentStatus.WARNING:
                    criticality_score += 0.7
                elif status == ComponentStatus.DEGRADED:
                    criticality_score += 0.5
                elif status == ComponentStatus.HEALTHY:
                    criticality_score += 0.1
                else:
                    criticality_score += 0.3
        
        criticality_score = criticality_score / len(affected_components) if affected_components else 0
        
        # Shortest-path depth from failed dependency to furthest affected node.
        distances = nx.single_source_shortest_path_length(reversed_graph, source_id)
        max_depth = max(distances.values(), default=0)
        
        depth_score = min(max_depth / 5, 1.0)  # Normalize depth score (max depth of 5)
        
        # Combine scores with weights
        impact_score = (0.4 * affected_ratio) + (0.4 * criticality_score) + (0.2 * depth_score)
        
        # Find failure domains within affected components
        subgraph = G.subgraph(affected_components)
        failure_domains = []
        
        # Use weakly connected components as failure domains
        for domain in nx.weakly_connected_components(subgraph):
            failure_domains.append(sorted(domain))
        
        return {
            "source_component": source_id,
            "affected_components": sorted(affected_components),
            "failure_domains": failure_domains,
            "impact_score": round(impact_score, 2),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def union_find_analysis(
        components: Dict[str, InfrastructureComponent],
        component_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Identify connected failure domains using Union-Find algorithm
        
        Args:
            components: Dictionary of infrastructure components
            component_ids: List of component IDs to analyze
            
        Returns:
            Dict: Analysis result with failure domains and impact score
        """
        # Filter components to those in the input list
        filtered_components = {
            comp_id: comp for comp_id, comp in components.items() 
            if comp_id in component_ids
        }
        
        # Build graph
        G = GraphAnalysis.build_graph(filtered_components)
        
        # Union-Find implementation
        class UnionFind:
            def __init__(self, nodes):
                self.parent = {node: node for node in nodes}
                self.rank = {node: 0 for node in nodes}
            
            def find(self, x):
                if self.parent[x] != x:
                    self.parent[x] = self.find(self.parent[x])  # Path compression
                return self.parent[x]
            
            def union(self, x, y):
                root_x = self.find(x)
                root_y = self.find(y)
                
                if root_x == root_y:
                    return
                
                # Union by rank
                if self.rank[root_x] < self.rank[root_y]:
                    self.parent[root_x] = root_y
                elif self.rank[root_x] > self.rank[root_y]:
                    self.parent[root_y] = root_x
                else:
                    self.parent[root_y] = root_x
                    self.rank[root_x] += 1
        
        # Create Union-Find data structure
        uf = UnionFind(filtered_components.keys())
        
        # Union components based on dependencies
        for comp_id, comp in filtered_components.items():
            for dep_id in comp.dependencies:
                if dep_id in filtered_components:
                    uf.union(comp_id, dep_id)
        
        # Find failure domains (connected components)
        domains = {}
        for comp_id in filtered_components:
            root = uf.find(comp_id)
            if root not in domains:
                domains[root] = []
            domains[root].append(comp_id)
        
        failure_domains = list(domains.values())
        
        # Calculate impact score based on:
        # 1. Number of failure domains (more domains = less interconnected = lower score)
        # 2. Size distribution of domains (more evenly distributed = lower score)
        # 3. Criticality of components in each domain
        
        num_domains = len(failure_domains)
        domain_size_variance = np.var([len(domain) for domain in failure_domains]) if num_domains > 0 else 0
        normalized_variance = min(domain_size_variance / 100, 1.0)  # Normalize variance
        
        # Calculate criticality for each domain
        domain_criticality = []
        for domain in failure_domains:
            domain_crit = 0.0
            for comp_id in domain:
                if comp_id in filtered_components:
                    status = filtered_components[comp_id].status
                    if status == ComponentStatus.CRITICAL:
                        domain_crit += 1.0
                    elif status == ComponentStatus.WARNING:
                        domain_crit += 0.7
                    elif status == ComponentStatus.DEGRADED:
                        domain_crit += 0.5
                    elif status == ComponentStatus.HEALTHY:
                        domain_crit += 0.1
                    else:
                        domain_crit += 0.3
            
            domain_criticality.append(domain_crit / len(domain) if domain else 0)
        
        avg_criticality = sum(domain_criticality) / len(domain_criticality) if domain_criticality else 0
        
        # Combine scores
        # More domains = lower interconnectivity = lower score
        domain_factor = 1.0 / (1.0 + 0.2 * num_domains)
        
        # Higher variance = more uneven distribution = higher score (more concentrated risk)
        # Higher criticality = higher score
        impact_score = (0.4 * domain_factor) + (0.3 * normalized_variance) + (0.3 * avg_criticality)
        
        return {
            "source_component": component_ids[0] if component_ids else None,
            "affected_components": component_ids,
            "failure_domains": failure_domains,
            "impact_score": round(impact_score, 2),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def health_status_analysis(components: Dict[str, InfrastructureComponent]) -> Dict[str, Any]:
        """
        Analyze overall infrastructure health status
        
        Args:
            components: Dictionary of infrastructure components
            
        Returns:
            Dict: Analysis result with health status and affected components
        """
        if not components:
            return {
                "source_component": "infrastructure",
                "affected_components": [],
                "failure_domains": [],
                "impact_score": 0.0,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        # Identify problematic components
        problematic = []
        for comp_id, comp in components.items():
            if comp.status in [ComponentStatus.CRITICAL, ComponentStatus.WARNING, ComponentStatus.DEGRADED]:
                problematic.append(comp_id)
        
        # If there are problematic components, perform impact analysis
        if problematic:
            # Build graph
            G = GraphAnalysis.build_graph(components)
            
            # Find affected components for each problematic component
            all_affected = set()
            failure_domains = []
            
            for prob_id in problematic:
                affected = set()
                
                # Dependencies point inward, so traverse the reversed graph.
                affected.update(nx.descendants(G.reverse(copy=False), prob_id))
                affected.add(prob_id)
                all_affected.update(affected)
                
                # Add as a failure domain if it has affected components
                if affected:
                    failure_domains.append(sorted(affected))
            
            # Calculate impact score
            total_components = len(components)
            affected_ratio = len(all_affected) / total_components if total_components > 0 else 0
            
            # Calculate criticality score
            criticality_score = 0.0
            for comp_id in all_affected:
                if comp_id in components:
                    status = components[comp_id].status
                    if status == ComponentStatus.CRITICAL:
                        criticality_score += 1.0
                    elif status == ComponentStatus.WARNING:
                        criticality_score += 0.7
                    elif status == ComponentStatus.DEGRADED:
                        criticality_score += 0.5
                    elif status == ComponentStatus.HEALTHY:
                        criticality_score += 0.1
                    else:
                        criticality_score += 0.3
            
            criticality_score = criticality_score / len(all_affected) if all_affected else 0
            
            # Calculate health impact score
            impact_score = (0.5 * affected_ratio) + (0.5 * criticality_score)
            
            return {
                "source_component": "infrastructure",
                "affected_components": sorted(all_affected),
                "failure_domains": failure_domains,
                "impact_score": round(impact_score, 2),
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            # All components are healthy
            return {
                "source_component": "infrastructure",
                "affected_components": [],
                "failure_domains": [],
                "impact_score": 0.0,
                "timestamp": datetime.utcnow().isoformat()
            }
