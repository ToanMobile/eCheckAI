import { haversineDistance, isWithinRadius } from '../../src/common/utils/haversine';

describe('haversineDistance', () => {
  it('should_return_zero_when_same_coordinates', () => {
    const dist = haversineDistance(10.7769, 106.7009, 10.7769, 106.7009);
    expect(dist).toBeCloseTo(0, 1);
  });

  it('should_return_correct_distance_between_known_points', () => {
    // Roughly 111km per degree of latitude
    const dist = haversineDistance(0, 0, 1, 0);
    expect(dist).toBeCloseTo(111195, -2); // ~111.2 km
  });

  it('should_return_symmetric_results', () => {
    const d1 = haversineDistance(10.7769, 106.7009, 10.7800, 106.7050);
    const d2 = haversineDistance(10.7800, 106.7050, 10.7769, 106.7009);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('should_return_approximately_500m_for_nearby_points', () => {
    // Approximately 0.004 degrees ~ 450m
    const dist = haversineDistance(10.7769, 106.7009, 10.7769, 106.7055);
    expect(dist).toBeGreaterThan(400);
    expect(dist).toBeLessThan(600);
  });
});

describe('isWithinRadius', () => {
  it('should_return_true_when_point_is_inside_radius', () => {
    const result = isWithinRadius(10.7769, 106.7009, 10.7769, 106.7009, 100);
    expect(result).toBe(true);
  });

  it('should_return_false_when_point_is_outside_radius', () => {
    // ~500m away
    const result = isWithinRadius(10.7769, 106.7009, 10.7769, 106.7055, 100);
    expect(result).toBe(false);
  });

  it('should_return_true_for_point_exactly_on_boundary', () => {
    // Very close point — should be within 10m
    const result = isWithinRadius(10.7769, 106.7009, 10.77690, 106.70091, 50);
    expect(result).toBe(true);
  });
});
