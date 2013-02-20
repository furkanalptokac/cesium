attribute vec3 position3DHigh;
attribute vec3 position3DLow;
attribute vec3 position2DHigh;
attribute vec3 position2DLow;
attribute vec4 prev;
attribute vec4 next;
attribute vec4 color;
attribute vec4 misc;

varying vec4 v_color;

uniform float u_morphTime;

vec3 sphericalToCartesian(vec2 latLon)
{
    float sinTheta = sin(latLon.x);
    float x = sinTheta * cos(latLon.y);
    float y = sinTheta * sin(latLon.y);
    float z = cos(latLon.x);
    return vec3(x, y, z);
}

void main() 
{
    float texCoord = misc.x;
    float expandDir = misc.y;
    float width = misc.z * 0.5;
    float show = misc.w;
    
    vec4 p;
    vec4 prevDir;
    vec4 nextDir;

    if (u_morphTime == 1.0)
    {
        p = vec4(czm_translateRelativeToEye(position3DHigh, position3DLow), 1.0);
        prevDir = vec4(sphericalToCartesian(prev.xy), 0.0);
        nextDir = vec4(sphericalToCartesian(next.xy), 0.0);
    }
    else if (u_morphTime == 0.0)
    {
        p = vec4(czm_translateRelativeToEye(position2DHigh.zxy, position2DLow.zxy), 1.0);
        prevDir = vec4(sphericalToCartesian(prev.zw), 0.0);
        nextDir = vec4(sphericalToCartesian(next.zw), 0.0);
    }
    else
    {
        p = czm_columbusViewMorph(
            czm_translateRelativeToEye(position2DHigh.zxy, position2DLow.zxy),
            czm_translateRelativeToEye(position3DHigh, position3DLow), 
            u_morphTime);
        prevDir = czm_columbusViewMorph(sphericalToCartesian(prev.xy), sphericalToCartesian(prev.zw), u_morphTime);
        nextDir = czm_columbusViewMorph(sphericalToCartesian(next.xy), sphericalToCartesian(next.zw), u_morphTime);
        
        prevDir.w = 0.0;
        nextDir.w = 0.0;
    }
    
    vec4 positionEC = czm_modelViewRelativeToEye * p;
    vec4 positionWC = czm_eyeToWindowCoordinates(positionEC);
    
    vec4 prevEC = czm_modelView * prevDir;
    vec4 nextEC = czm_modelView * nextDir;
    
    vec4 prevWC = czm_eyeToWindowCoordinates(vec4(prevEC.xyz + positionEC.xyz, 1.0));
    prevWC.xy = normalize(prevWC.xy - positionWC.xy);
    vec4 nextWC = czm_eyeToWindowCoordinates(vec4(nextEC.xyz + positionEC.xyz, 1.0));
    nextWC.xy = normalize(nextWC.xy - positionWC.xy);
    
    float angle = acos(dot(prevWC.xy, nextWC.xy));
    
    vec2 direction;
    if (abs(angle - czm_pi) < czm_epsilon1)
    {
        mat2 rotation = mat2(cos(czm_piOverTwo), sin(czm_piOverTwo), -sin(czm_piOverTwo), cos(czm_piOverTwo));
        direction = rotation * nextWC.xy;
        direction *= width;
    }
    else
    {
        direction = normalize((prevWC.xy + nextWC.xy) * 0.5);
        direction *= width / sin(angle * 0.5);
    }
    
    positionWC.xy += direction * expandDir;
    
    gl_Position = czm_viewportOrthographic * vec4(positionWC.xy, -positionWC.z, 1.0);
    
    v_color = color;
}
